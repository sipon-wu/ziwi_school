package handler

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/zhiwei/backend/internal/repository"
)

// ImportHandler 数据初始化批量导入处理器
type ImportHandler struct {
	repo *repository.ImportRepository
}

func NewImportHandler(repo *repository.ImportRepository) *ImportHandler {
	return &ImportHandler{repo: repo}
}

var validTypes = map[string]bool{
	"classes":   true,
	"teachers":  true,
	"students":  true,
	"relations": true,
}

// 表头中文 → 字段 映射
var headerMap = map[string]map[string]string{
	"classes": {
		"校区": "Campus", "年级": "Grade", "班级名称": "Name", "班级类型": "ClassType",
	},
	"teachers": {
		"姓名": "Name", "手机号": "Phone", "任教年级": "Grade", "任教班级": "ClassName",
		"任教学科": "Subject", "角色": "Role", "是否班主任": "IsHead",
	},
	"students": {
		"姓名": "Name", "学号": "StudentNumber", "校区": "Campus", "年级": "Grade",
		"班级": "ClassName", "家长手机号": "ParentPhone",
	},
	"relations": {
		"教师手机号": "TeacherPhone", "年级": "Grade", "班级": "ClassName", "学科": "Subject",
	},
}

// Import 批量导入（两阶段：?dry_run=1 预校验，否则执行）
// POST /api/admin/import/:type
func (h *ImportHandler) Import(c *gin.Context) {
	typ := c.Param("type")
	if !validTypes[typ] {
		c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_TYPE", "message": "不支持的导入类型"})
		return
	}
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	createdBy, _ := c.Get("user_id")
	createdByStr, _ := createdBy.(string)

	dryRun := c.Query("dry_run") == "1"

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "NO_FILE", "message": "请上传 CSV 文件"})
		return
	}
	records, err := parseCSVFile(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "CSV_PARSE_FAILED", "message": "CSV 解析失败：" + err.Error()})
		return
	}
	if len(records) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"code": "EMPTY_DATA", "message": "文件无数据行"})
		return
	}
	header := records[0]
	data := records[1:]

	switch typ {
	case "classes":
		rows, merr := mapRows(header, data, headerMap["classes"], func(m map[string]string) (interface{}, error) {
			return repository.ClassImportRow{
				Campus:    m["Campus"],
				Grade:     m["Grade"],
				Name:      m["Name"],
				ClassType: m["ClassType"],
			}, nil
		})
		if merr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": "MAP_FAILED", "message": merr.Error()})
			return
		}
		res, rerr := h.repo.ImportClasses(schoolIDStr, createdByStr, toClassRows(rows), dryRun)
		respondImport(c, res, rerr)
	case "teachers":
		rows, merr := mapRows(header, data, headerMap["teachers"], func(m map[string]string) (interface{}, error) {
			return repository.TeacherImportRow{
				Name:      m["Name"],
				Phone:     m["Phone"],
				Grade:     m["Grade"],
				ClassName: m["ClassName"],
				Subject:   m["Subject"],
				Role:      m["Role"],
				IsHead:    isYes(m["IsHead"]),
			}, nil
		})
		if merr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": "MAP_FAILED", "message": merr.Error()})
			return
		}
		res, rerr := h.repo.ImportTeachers(schoolIDStr, createdByStr, toTeacherRows(rows), dryRun)
		respondImport(c, res, rerr)
	case "students":
		rows, merr := mapRows(header, data, headerMap["students"], func(m map[string]string) (interface{}, error) {
			return repository.StudentImportRow{
				Name:          m["Name"],
				StudentNumber: m["StudentNumber"],
				Campus:        m["Campus"],
				Grade:         m["Grade"],
				ClassName:     m["ClassName"],
				ParentPhone:   m["ParentPhone"],
			}, nil
		})
		if merr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": "MAP_FAILED", "message": merr.Error()})
			return
		}
		res, rerr := h.repo.ImportStudents(schoolIDStr, createdByStr, toStudentRows(rows), dryRun)
		respondImport(c, res, rerr)
	case "relations":
		rows, merr := mapRows(header, data, headerMap["relations"], func(m map[string]string) (interface{}, error) {
			return repository.RelationImportRow{
				TeacherPhone: m["TeacherPhone"],
				Grade:        m["Grade"],
				ClassName:    m["ClassName"],
				Subject:      m["Subject"],
			}, nil
		})
		if merr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"code": "MAP_FAILED", "message": merr.Error()})
			return
		}
		res, rerr := h.repo.ImportRelations(schoolIDStr, createdByStr, toRelationRows(rows), dryRun)
		respondImport(c, res, rerr)
	}
}

func respondImport(c *gin.Context, res *repository.ImportResult, err error) {
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "IMPORT_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

// History 导入历史
// GET /api/admin/import/history
func (h *ImportHandler) History(c *gin.Context) {
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)
	batches, err := h.repo.ListBatches(schoolIDStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "QUERY_FAILED", "message": "获取导入历史失败"})
		return
	}
	items := make([]gin.H, 0, len(batches))
	for _, b := range batches {
		items = append(items, gin.H{
			"id":           b.ID,
			"type":         b.Type,
			"status":       b.Status,
			"total_rows":   b.TotalRows,
			"created_rows": b.CreatedRows,
			"skipped_rows": b.SkippedRows,
			"created_at":   b.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// Rollback 按 batch_id 全回滚
// POST /api/admin/import/:batchId/rollback
func (h *ImportHandler) Rollback(c *gin.Context) {
	batchID := c.Param("batchId")
	schoolID, _ := c.Get("school_id")
	schoolIDStr, _ := schoolID.(string)

	batch, err := h.repo.GetBatch(batchID, schoolIDStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "BATCH_NOT_FOUND", "message": "批次不存在或无权访问"})
		return
	}
	if batch.Status == "rolled_back" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "ALREADY_ROLLED_BACK", "message": "该批次已回滚"})
		return
	}
	if err := h.repo.Rollback(batch); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "ROLLBACK_FAILED", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "回滚成功", "batch_id": batchID})
}

// ── CSV 解析与映射辅助 ──

func parseCSVFile(file *multipart.FileHeader) ([][]string, error) {
	f, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()

	raw, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}
	// 去除 BOM
	raw = bytes.TrimPrefix(raw, []byte("\xEF\xBB\xBF"))
	// 中文 Excel 常把全角逗号混用，统一替换为半角
	content := strings.ReplaceAll(string(raw), "，", ",")

	reader := csv.NewReader(strings.NewReader(content))
	reader.FieldsPerRecord = -1 // 允许不定长
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	all, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}
	// 跳过以 # 开头的说明行
	out := make([][]string, 0, len(all))
	for _, row := range all {
		if len(row) == 0 {
			continue
		}
		if strings.HasPrefix(strings.TrimSpace(row[0]), "#") {
			continue
		}
		out = append(out, row)
	}
	return out, nil
}

// mapRows 将 CSV 记录按表头映射为结构体切片
func mapRows(header []string, data [][]string, fieldMap map[string]string, fn func(map[string]string) (interface{}, error)) ([]interface{}, error) {
	// 建立 中文表头 → 列索引
	idx := map[string]int{}
	for i, h := range header {
		idx[strings.TrimSpace(h)] = i
	}
	out := make([]interface{}, 0, len(data))
	for r, row := range data {
		m := map[string]string{}
		for cn, field := range fieldMap {
			if i, ok := idx[cn]; ok && i < len(row) {
				m[field] = strings.TrimSpace(row[i])
			} else {
				m[field] = ""
			}
		}
		v, err := fn(m)
		if err != nil {
			return nil, fmt.Errorf("第 %d 行：%v", r+2, err)
		}
		out = append(out, v)
	}
	return out, nil
}

func isYes(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "是", "yes", "y", "1", "true", "t":
		return true
	default:
		return false
	}
}

func toClassRows(in []interface{}) []repository.ClassImportRow {
	out := make([]repository.ClassImportRow, len(in))
	for i, v := range in {
		out[i] = v.(repository.ClassImportRow)
	}
	return out
}

func toTeacherRows(in []interface{}) []repository.TeacherImportRow {
	out := make([]repository.TeacherImportRow, len(in))
	for i, v := range in {
		out[i] = v.(repository.TeacherImportRow)
	}
	return out
}

func toStudentRows(in []interface{}) []repository.StudentImportRow {
	out := make([]repository.StudentImportRow, len(in))
	for i, v := range in {
		out[i] = v.(repository.StudentImportRow)
	}
	return out
}

func toRelationRows(in []interface{}) []repository.RelationImportRow {
	out := make([]repository.RelationImportRow, len(in))
	for i, v := range in {
		out[i] = v.(repository.RelationImportRow)
	}
	return out
}
