-- Fix user roles for new architecture v3.3
UPDATE users SET role = 'it_admin' WHERE phone = '13800000001';
UPDATE users SET role = 'teacher' WHERE phone = '13800000002';
UPDATE users SET role = 'research_lead' WHERE phone = '13800000003';
UPDATE users SET role = 'registrar' WHERE phone = '13800000004';
UPDATE users SET role = 'principal' WHERE phone = '13800000005';

-- Add missing platform users
INSERT INTO users (id, phone, name, role, password_hash, school_id, status)
SELECT gen_random_uuid(), '13800000006', '赵运营', 'platform_ops', (SELECT password_hash FROM users WHERE phone='13800000001' LIMIT 1), (SELECT school_id FROM users WHERE phone='13800000002' LIMIT 1), 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone = '13800000006');

INSERT INTO users (id, phone, name, role, password_hash, school_id, status)
SELECT gen_random_uuid(), '13800000007', '孙运维', 'platform_devops', (SELECT password_hash FROM users WHERE phone='13800000001' LIMIT 1), (SELECT school_id FROM users WHERE phone='13800000002' LIMIT 1), 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone = '13800000007');

INSERT INTO users (id, phone, name, role, password_hash, school_id, status)
SELECT gen_random_uuid(), '13800000008', '周主任', 'head_teacher', (SELECT password_hash FROM users WHERE phone='13800000002' LIMIT 1), (SELECT school_id FROM users WHERE phone='13800000002' LIMIT 1), 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone = '13800000008');

SELECT phone, name, role FROM users WHERE phone LIKE '1380000000%' ORDER BY phone;
