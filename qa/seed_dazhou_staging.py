#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
达州一小（仿真）staging 种子生成器
- 生成 bcrypt 密码哈希
- 生成学校/校区/班级/用户/师生关系/教材偏好的 INSERT SQL（幂等可重跑）
- 输出 dazhou_credentials.json 供后续仿真/验证脚本使用

重要边界（2026-07-30 拍板，勿再误建）：
- 没有学生端，由家长端代理。学生仅为花名册记录（姓名+学号+班级）：
  phone 为占位哨兵、password_hash 为空（不可登录）、无 email。
- 每名学生预留 1 名家长账号（role=parent）：家长端未开通，password_hash 为空
  （不可登录）、status=pending，占用真实演示号段，待家长端开通后认领激活。

运行：python3 qa/seed_dazhou_staging.py
产物：qa/seed_dazhou_staging.sql  +  qa/dazhou_credentials.json
"""
import bcrypt
import uuid
import json
import datetime

PW = "Dazhou@2026"
PHASH = bcrypt.hashpw(PW.encode(), bcrypt.gensalt()).decode()
NOW = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

SCHOOL = "sch-dazhou-stc"
CAMPUS = "cmp-dazhou-stc-main"
SCHOOL_NAME = "达州市通川区第一小学（仿真）"
GRADES = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"]
BASE = "http://school1.ziwi.cn"

# 人教系版本映射（与 tb_textbook_version 对齐）
VERSION = {
    "语文": ("人民教育出版社", "统编版"),
    "数学": ("人民教育出版社", "人教版"),
    "英语": ("人民教育出版社", "人教版（PEP）（主编：吴欣）"),
    "科学": ("人民教育出版社", "人教鄂教版"),
}

# 各学段第一课标题
LESSON_TITLE = {
    ("语文", "一年级"): "秋天",
    ("语文", "二年级"): "小蝌蚪找妈妈",
    ("语文", "三年级"): "大青树下的小学",
    ("语文", "四年级"): "观潮",
    ("语文", "五年级"): "白鹭",
    ("语文", "六年级"): "草原",
    ("数学", "一年级"): "准备课",
    ("数学", "二年级"): "长度单位",
    ("数学", "三年级"): "时、分、秒",
    ("数学", "四年级"): "大数的认识",
    ("数学", "五年级"): "小数乘法",
    ("数学", "六年级"): "分数乘法",
    ("英语", "三年级"): "Unit 1 Hello!",
    ("英语", "四年级"): "Unit 1 My classroom",
    ("英语", "五年级"): "Unit 1 What's he like?",
    ("英语", "六年级"): "Unit 1 How can I get there?",
    ("科学", "一年级"): "走近科学",
    ("科学", "二年级"): "我们的地球家园",
    ("科学", "三年级"): "水",
    ("科学", "四年级"): "声音",
    ("科学", "五年级"): "光",
    ("科学", "六年级"): "微小世界",
}
# 单元（教材单元/章节），用于 AI 生成
UNIT = {
    ("语文", "一年级"): "第一单元",
    ("语文", "二年级"): "第一单元",
    ("语文", "三年级"): "第一单元",
    ("语文", "四年级"): "第一单元",
    ("语文", "五年级"): "第一单元",
    ("语文", "六年级"): "第一单元",
    ("数学", "一年级"): "第一单元 准备课",
    ("数学", "二年级"): "第一单元 长度单位",
    ("数学", "三年级"): "第一单元 时、分、秒",
    ("数学", "四年级"): "第一单元 大数的认识",
    ("数学", "五年级"): "第一单元 小数乘法",
    ("数学", "六年级"): "第一单元 分数乘法",
    ("英语", "三年级"): "Unit 1 Hello!",
    ("英语", "四年级"): "Unit 1 My classroom",
    ("英语", "五年级"): "Unit 1 What's he like?",
    ("英语", "六年级"): "Unit 1 How can I get there?",
    ("科学", "一年级"): "第一单元 走近科学",
    ("科学", "二年级"): "第一单元 我们的地球家园",
    ("科学", "三年级"): "第一单元 水",
    ("科学", "四年级"): "第一单元 声音",
    ("科学", "五年级"): "第一单元 光",
    ("科学", "六年级"): "第一单元 微小世界",
}

# 每个学科覆盖的年级
SUBJECT_GRADES = {
    "语文": GRADES,
    "数学": GRADES,
    "英语": GRADES[2:],   # 三~六年级
    "科学": GRADES,
}

sql = []
cred = {
    "school_id": SCHOOL,
    "campus_id": CAMPUS,
    "school_name": SCHOOL_NAME,
    "password": PW,
    "base": BASE,
    "roles": {},
    "teachers": [],
    "classes": [],
    "students": [],
}

def esc(s):
    return "'" + str(s).replace("'", "''") + "'"

def suid():
    # users.id 为 varchar(30)，uuid4 36 字符超长，改用短 ID
    return "u" + uuid.uuid4().hex[:24]

# ---- 幂等清理（无 FK，按依赖顺序删子表；无 school_id 的表用子查询） ----
sql.append("-- 幂等清理达州仿真数据")
sql.append(f"DELETE FROM parent_signatures WHERE assignment_id IN (SELECT id FROM assignments WHERE school_id={esc(SCHOOL)});")
sql.append(f"DELETE FROM grading_results WHERE submission_id IN (SELECT id FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE school_id={esc(SCHOOL)}));")
sql.append(f"DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE school_id={esc(SCHOOL)});")
sql.append(f"DELETE FROM attempt_events WHERE assignment_id IN (SELECT id FROM assignments WHERE school_id={esc(SCHOOL)});")
sql.append(f"DELETE FROM student_observations WHERE student_id IN (SELECT id FROM users WHERE school_id={esc(SCHOOL)});")
sql.append(f"DELETE FROM growth_care_records WHERE school_id={esc(SCHOOL)};")
sql.append(f"DELETE FROM student_classes WHERE class_id IN (SELECT id FROM classes WHERE school_id={esc(SCHOOL)});")
sql.append(f"DELETE FROM parent_students WHERE parent_id IN (SELECT id FROM users WHERE school_id={esc(SCHOOL)});")
sql.append(f"DELETE FROM teacher_classes WHERE teacher_id IN (SELECT id FROM users WHERE school_id={esc(SCHOOL)}) OR class_id IN (SELECT id FROM classes WHERE school_id={esc(SCHOOL)});")
sql.append(f"DELETE FROM teacher_textbook_pref WHERE school_id={esc(SCHOOL)};")
sql.append(f"DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE school_id={esc(SCHOOL)});")
sql.append(f"DELETE FROM lesson_plans WHERE school_id={esc(SCHOOL)};")
sql.append(f"DELETE FROM questions WHERE school_id={esc(SCHOOL)};")
sql.append(f"DELETE FROM assignments WHERE school_id={esc(SCHOOL)};")
sql.append(f"DELETE FROM users WHERE school_id={esc(SCHOOL)};")
sql.append(f"DELETE FROM classes WHERE school_id={esc(SCHOOL)};")
sql.append(f"DELETE FROM campuses WHERE school_id={esc(SCHOOL)};")
sql.append(f"DELETE FROM schools WHERE id={esc(SCHOOL)};")

# ---- 学校 / 校区 ----
sql.append("-- 学校 / 校区")
sql.append(
    f"INSERT INTO schools (id, full_name, region, system_type, license_status, created_at, updated_at) "
    f"VALUES ({esc(SCHOOL)}, {esc(SCHOOL_NAME)}, '四川省达州市通川区', '六三制', 'active', '{NOW}', '{NOW}');"
)
sql.append(
    f"INSERT INTO campuses (id, school_id, name, address, status, created_at, updated_at) "
    f"VALUES ({esc(CAMPUS)}, {esc(SCHOOL)}, '本部', '达州市通川区', 'active', '{NOW}', '{NOW}');"
)

# ---- 用户生成 ----
users_rows = []
phone_seq = 13900000001
def next_phone():
    global phone_seq
    p = phone_seq
    phone_seq += 1
    return str(p)

def add_user(role, name, grade=None, class_id=None, employee_no=None, student_no=None,
             subject=None, is_head=False):
    global phone_seq
    uid = suid()
    phone = next_phone()
    email = f"{phone}@dazhou.sim"
    cols = ["id", "name", "phone", "password_hash", "email", "role",
            "school_id", "status", "created_at", "updated_at"]
    vals = [esc(uid), esc(name), esc(phone), esc(PHASH), esc(email),
            esc(role), esc(SCHOOL), esc("active"), f"'{NOW}'", f"'{NOW}'"]
    if grade:
        cols.append("grade"); vals.append(esc(grade))
    if subject:
        cols.append("subject"); vals.append(esc(subject))
    if student_no:
        cols.append("student_number"); vals.append(esc(student_no))
    cols.append("campus_id"); vals.append(esc(CAMPUS))
    sql.append(f"INSERT INTO users ({', '.join(cols)}) VALUES ({', '.join(vals)});")
    return {"uid": uid, "phone": phone, "name": name, "role": role, "grade": grade,
            "class_id": class_id, "subject": subject, "employee_no": employee_no,
            "student_no": student_no, "is_head": is_head}

# 管理层
principal = add_user("principal", "达州一小·校长")
it_admin = add_user("it_admin", "达州一小·信息管理员")
registrar = add_user("registrar", "达州一小·教务员")
cred["roles"]["principal"] = principal["phone"]
cred["roles"]["it_admin"] = it_admin["phone"]
cred["roles"]["registrar"] = registrar["phone"]

research_leads = {}
for subj in ["语文", "数学", "英语", "科学"]:
    rl = add_user("research_lead", f"达州一小·{subj}教研组长")
    research_leads[subj] = rl
    cred["roles"]["research_lead_" + subj] = rl["phone"]

# 班级 + 教师（语文老师兼班主任）
classes = {}
teacher_by_sg = {}   # (subject, grade) -> user dict
head_by_grade = {}   # grade -> 语文老师 uid
for gi, g in enumerate(GRADES, start=1):
    class_id = f"cls-dz-g{gi}-1"
    name = f"{g[0]}（1）班"  # 一（1）班
    classes[g] = {"class_id": class_id, "name": name, "grade": g, "students": []}
    # 语文老师 = 班主任
    ch = add_user("head_teacher", f"{g}语文老师（班主任）", grade=g, class_id=class_id,
                  employee_no=f"T{g}CH", subject="语文", is_head=True)
    teacher_by_sg[("语文", g)] = ch
    head_by_grade[g] = ch
    # 数学老师
    mt = add_user("teacher", f"{g}数学老师", grade=g, class_id=class_id,
                  employee_no=f"T{g}M", subject="数学")
    teacher_by_sg[("数学", g)] = mt
    # 科学老师
    sc = add_user("teacher", f"{g}科学老师", grade=g, class_id=class_id,
                  employee_no=f"T{g}S", subject="科学")
    teacher_by_sg[("科学", g)] = sc
    # 英语老师（三~六年级）
    if g in SUBJECT_GRADES["英语"]:
        en = add_user("teacher", f"{g}英语老师", grade=g, class_id=class_id,
                      employee_no=f"T{g}E", subject="英语")
        teacher_by_sg[("英语", g)] = en

# 班级行（含 head_teacher_id）
sql.append("-- 班级")
for g, c in classes.items():
    ht = head_by_grade[g]["uid"]
    sql.append(
        f"INSERT INTO classes (id, school_id, campus_id, name, grade, head_teacher_id, created_at) "
        f"VALUES ({esc(c['class_id'])}, {esc(SCHOOL)}, {esc(CAMPUS)}, {esc(c['name'])}, {esc(g)}, {esc(ht)}, '{NOW}');"
    )

# 师生关系 + 教材偏好
sql.append("-- 师生关系 + 教材偏好")
for (subj, g), t in teacher_by_sg.items():
    cid = classes[g]["class_id"]
    pub, ver = VERSION[subj]
    sql.append(
        f"INSERT INTO teacher_classes (teacher_id, class_id, subject, is_primary, created_at) "
        f"VALUES ({esc(t['uid'])}, {esc(cid)}, {esc(subj)}, true, '{NOW}');"
    )
    sql.append(
        f"INSERT INTO teacher_textbook_pref (teacher_id, school_id, grade, class_id, subject, publisher, version_name) "
        f"VALUES ({esc(t['uid'])}, {esc(SCHOOL)}, {esc(g)}, {esc(cid)}, {esc(subj)}, {esc(pub)}, {esc(ver)});"
    )

# 学生花名册（没有学生端，由家长端代理：无登录凭据，phone 为占位哨兵）
# + 每名学生预留 1 名家长账号（家长端未开通：空密码不可登录，status=pending）
sql.append("-- 学生花名册（无登录凭据）+ 预留家长账号（家长端未开通，不可登录）")
par_seq = 13900010001  # 真实演示号段留给家长（原学生号段整体移交）
for gi, (g, c) in enumerate(classes.items(), start=1):
    for n in range(1, 11):
        uid = suid()
        sno = f"{g[0]}{n:02d}"
        sentinel = f"stu_dz_g{gi}_{n:02d}"  # 占位哨兵，非真实手机号
        sql.append(
            f"INSERT INTO users (id, name, phone, password_hash, role, school_id, "
            f"grade, student_number, campus_id, status, created_at, updated_at) "
            f"VALUES ({esc(uid)}, {esc(f'{g[0]}班学生{n}')}, {esc(sentinel)}, '', "
            f"'student', {esc(SCHOOL)}, {esc(g)}, {esc(sno)}, "
            f"{esc(CAMPUS)}, 'active', '{NOW}', '{NOW}');"
        )
        sql.append(
            f"INSERT INTO student_classes (student_id, class_id, enrolled_at) "
            f"VALUES ({esc(uid)}, {esc(c['class_id'])}, '{NOW}');"
        )
        # 预留家长账号
        pid = suid()
        pphone = str(par_seq); par_seq += 1
        pname = f"{g[0]}班学生{n}家长"
        sql.append(
            f"INSERT INTO users (id, name, phone, password_hash, role, school_id, "
            f"grade, campus_id, status, created_at, updated_at) "
            f"VALUES ({esc(pid)}, {esc(pname)}, {esc(pphone)}, '', 'parent', "
            f"{esc(SCHOOL)}, {esc(g)}, {esc(CAMPUS)}, 'pending', '{NOW}', '{NOW}');"
        )
        sql.append(
            f"INSERT INTO parent_students (parent_id, student_id, relationship, is_primary) "
            f"VALUES ({esc(pid)}, {esc(uid)}, 'parent', true) ON CONFLICT DO NOTHING;"
        )
        stu = {"uid": uid, "name": f"{g[0]}班学生{n}", "grade": g,
               "class_id": c["class_id"], "student_no": sno,
               "login": None,  # 没有学生端，由家长端代理
               "parent": {"uid": pid, "phone": pphone, "name": pname,
                          "status": "pending", "note": "家长端未开通，预留账号不可登录"}}
        c["students"].append(stu)
        cred["students"].append(stu)

# ---- 汇总到 cred ----
for (subj, g), t in teacher_by_sg.items():
    t["grade"] = g
    t["subject"] = subj
    t["class_id"] = classes[g]["class_id"]
    cred["teachers"].append(t)
for g, c in classes.items():
    cred["classes"].append({
        "grade": g, "class_id": c["class_id"], "name": c["name"],
        "head_teacher_phone": head_by_grade[g]["phone"],
        "students": [s["student_no"] for s in c["students"]],  # 花名册学号（学生无手机号）
        "parent_phones": [s["parent"]["phone"] for s in c["students"]],
    })

# ---- 写出 ----
with open("qa/seed_dazhou_staging.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(sql) + "\n")
with open("qa/dazhou_credentials.json", "w", encoding="utf-8") as f:
    json.dump(cred, f, ensure_ascii=False, indent=2)

print("SQL 行数:", len(sql))
print("学校:", SCHOOL, SCHOOL_NAME)
print("教师数:", len(cred["teachers"]), " 学生数:", len(cred["students"]),
      " 班级数:", len(cred["classes"]))
print("管理层 phones: principal=%s it=%s registrar=%s" % (
    principal["phone"], it_admin["phone"], registrar["phone"]))
print("已写出 qa/seed_dazhou_staging.sql 与 qa/dazhou_credentials.json")
