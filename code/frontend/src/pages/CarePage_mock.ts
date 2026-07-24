// CarePage 降级 mock 数据（后端不可用时自动加载）
const INIT_STUDENTS = [
  { id: 's1', name: '赵大鹏', studentNo: '20240007', gender: '男', grade: 4, enrolledDate: '2026-03-01', status: 'activated', planProgress: 73, accuracy: 68, accuracyTrend: 'up', accuracyChange: 6, focusArea: '异分母分数比较是当前薄弱环节，通分步骤需强化' },
  { id: 's2', name: '孙小飞', studentNo: '20240008', gender: '男', grade: 4, enrolledDate: '2026-03-15', status: 'activated', planProgress: 60, accuracy: 55, accuracyTrend: 'up', accuracyChange: 3, focusArea: '排比句运用需从仿写过渡到独立创作' },
  { id: 's3', name: '钱小强', studentNo: '20240011', gender: '男', grade: 4, enrolledDate: '2026-04-10', status: 'activated', planProgress: 40, accuracy: 62, accuracyTrend: 'flat', accuracyChange: 0, focusArea: '成绩处于平台期，首要目标是恢复练习量' },
  { id: 's4', name: '冯小美', studentNo: '20240012', gender: '女', grade: 4, enrolledDate: '2026-04-20', status: 'pending', planProgress: 55, accuracy: 58, accuracyTrend: 'down', accuracyChange: 4, focusArea: '多角度提问能力需加强' },
  { id: 's5', name: '苗小光', studentNo: '20240045', gender: '男', grade: 4, enrolledDate: '2026-05-05', status: 'activated', planProgress: 83, accuracy: 71, accuracyTrend: 'up', accuracyChange: 8, focusArea: '分数混合运算进步显著，建议逐步引入复杂运算' },
  { id: 's6', name: '花小玉', studentNo: '20240046', gender: '女', grade: 4, enrolledDate: '2026-06-01', status: 'pending', planProgress: 65, accuracy: 65, accuracyTrend: 'up', accuracyChange: 2, focusArea: '词语理解有改善迹象，巩固为主' },
  { id: 's7', name: '褚小刚', studentNo: '20240013', gender: '男', grade: 4, enrolledDate: '2026-02-15', removedDate: '2026-06-20', status: 'removed', planProgress: 0, accuracy: 76, accuracyTrend: 'up', accuracyChange: 4, focusArea: '已达标移出，历史记录保留' },
]

export default INIT_STUDENTS
