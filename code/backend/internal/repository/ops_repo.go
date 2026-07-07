package repository

import (
	"time"

	"gorm.io/gorm"
)

// TokenUsageView Token消耗视图
type TokenUsageView struct {
	SchoolID   string `gorm:"type:varchar(50)" json:"school_id"`
	SchoolName string `gorm:"->" json:"school_name"`
	TotalUsed  int64  `json:"total_used"`
	Quota      int64  `json:"quota"`
}

// LicenseView License视图
type LicenseView struct {
	ID        string     `gorm:"type:varchar(50)" json:"id"`
	SchoolName string    `gorm:"->" json:"school_name"`
	Plan      string     `gorm:"type:varchar(30)" json:"plan"`
	Status    string     `gorm:"type:varchar(20)" json:"status"`
	ExpiresAt time.Time  `json:"expires_at"`
}

// Announcement 公告
type Announcement struct {
	ID        string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	Title     string    `gorm:"type:varchar(200);not null" json:"title"`
	Content   string    `gorm:"type:text" json:"content"`
	IsPinned  bool      `gorm:"default:false" json:"is_pinned"`
	Status    string    `gorm:"type:varchar(20);default:published" json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

func (Announcement) TableName() string {
	return "announcements"
}

// FinanceSummary 财务摘要
type FinanceSummary struct {
	TotalRevenue  float64 `json:"total_revenue"`
	ActiveSchools int64   `json:"active_schools"`
	MonthlyRevenue float64 `json:"monthly_revenue"`
}

// Invoice 发票
type Invoice struct {
	ID         string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolName string    `gorm:"->" json:"school_name"`
	Amount     float64   `gorm:"type:decimal(10,2)" json:"amount"`
	Title      string    `gorm:"type:varchar(200)" json:"title"`
	Status     string    `gorm:"type:varchar(20)" json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

// SupportTicket 客服工单
type SupportTicket struct {
	ID        string    `gorm:"type:varchar(50);primaryKey;default:gen_random_uuid()" json:"id"`
	SchoolName string   `gorm:"->" json:"school_name"`
	Title     string    `gorm:"type:varchar(200);not null" json:"title"`
	Status    string    `gorm:"type:varchar(20);default:open" json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type OpsRepository struct {
	db *gorm.DB
}

func NewOpsRepository(db *gorm.DB) *OpsRepository {
	return &OpsRepository{db: db}
}

func (r *OpsRepository) AutoMigrate() error {
	return r.db.AutoMigrate(&Announcement{}, &Invoice{}, &SupportTicket{})
}

// ListTokenUsage Token用量
func (r *OpsRepository) ListTokenUsage() ([]TokenUsageView, error) {
	var items []TokenUsageView
	err := r.db.Raw(`
		SELECT s.id as school_id, COALESCE(s.name, '') as school_name,
			COALESCE(s.default_token_quota, 0) as quota,
			0 as total_used
		FROM schools s
		ORDER BY s.created_at DESC
	`).Scan(&items).Error
	return items, err
}

// ListLicenses License列表
func (r *OpsRepository) ListLicenses() ([]LicenseView, error) {
	var items []LicenseView
	err := r.db.Raw(`
		SELECT l.id, s.full_name as school_name, l.plan, l.status, l.expires_at
		FROM licenses l
		JOIN schools s ON s.id = l.school_id
		ORDER BY l.expires_at ASC
	`).Scan(&items).Error
	return items, err
}

// ListAnnouncements 公告列表
func (r *OpsRepository) ListAnnouncements() ([]Announcement, error) {
	var items []Announcement
	err := r.db.Order("is_pinned DESC, created_at DESC").Find(&items).Error
	return items, err
}

// CreateAnnouncement 创建公告
func (r *OpsRepository) CreateAnnouncement(a *Announcement) error {
	return r.db.Create(a).Error
}

// GetFinanceSummary 财务摘要
func (r *OpsRepository) GetFinanceSummary() (*FinanceSummary, error) {
	var s FinanceSummary
	r.db.Raw(`SELECT COALESCE(SUM(amount), 0) as total_revenue FROM orders WHERE payment_status = 'paid'`).Scan(&s.TotalRevenue)
	r.db.Raw(`SELECT COUNT(*) FROM schools WHERE status = 'active'`).Scan(&s.ActiveSchools)
	r.db.Raw(`SELECT COALESCE(SUM(amount), 0) FROM orders WHERE payment_status = 'paid' AND paid_at >= date_trunc('month', NOW())`).Scan(&s.MonthlyRevenue)
	return &s, nil
}

// ListInvoices 发票列表
func (r *OpsRepository) ListInvoices() ([]Invoice, error) {
	var items []Invoice
	err := r.db.Raw(`
		SELECT i.id, s.full_name as school_name, i.amount, i.title, i.status, i.created_at
		FROM invoices i
		LEFT JOIN schools s ON s.id = i.school_id
		ORDER BY i.created_at DESC
	`).Scan(&items).Error
	return items, err
}

// ListSupportTickets 客服工单
func (r *OpsRepository) ListSupportTickets() ([]SupportTicket, error) {
	var items []SupportTicket
	err := r.db.Raw(`
		SELECT st.id, s.full_name as school_name, st.title, st.status, st.created_at
		FROM support_tickets st
		LEFT JOIN schools s ON s.id = st.school_id
		ORDER BY st.created_at DESC
	`).Scan(&items).Error
	return items, err
}
