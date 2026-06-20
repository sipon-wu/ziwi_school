import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'

// PC 教师端
import DashboardLayout from './components/layout/DashboardLayout'
import DashboardHome from './pages/DashboardHome'
import LessonPlanList from './pages/LessonPlanList'
import LessonPlanEditor from './pages/LessonPlanEditor'
import ExerciseList from './pages/ExerciseList'
import ExerciseGenerator from './pages/ExerciseGenerator'
import CompositionList from './pages/CompositionList'
import GradingWorkbench from './pages/GradingWorkbench'
import GradingDetail from './pages/GradingDetail'
import ClassAnalytics from './pages/ClassAnalytics'
import ParentSignList from './pages/ParentSignList'
import SettingsPage from './pages/SettingsPage'
import LicenseAdmin from './pages/LicenseAdmin'

// WAP 移动端
import MobileLayout from './components/layout/MobileLayout'
import StudentAssignmentList from './pages/wap/StudentAssignmentList'
import StudentAnswerPage from './pages/wap/StudentAnswerPage'
import StudentGradingView from './pages/wap/StudentGradingView'
import StudentErrorBook from './pages/wap/StudentErrorBook'
import ParentAssignmentList from './pages/wap/ParentAssignmentList'
import ParentSignPage from './pages/wap/ParentSignPage'

// WAP 底部导航配置
import { FileText, AlertCircle } from 'lucide-react'

const studentTabs = [
  { path: '/m/student', label: '作业', icon: FileText },
  { path: '/m/student/error-book', label: '错题本', icon: AlertCircle },
]
const parentTabs = [
  { path: '/m/parent', label: '作业', icon: FileText },
]

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* ── PC 教师端 ── */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="lesson-plans" element={<LessonPlanList />} />
          <Route path="lesson-plans/new" element={<LessonPlanEditor />} />
          <Route path="lesson-plans/:id/edit" element={<LessonPlanEditor />} />
          <Route path="exercises" element={<ExerciseList />} />
          <Route path="exercises/new" element={<ExerciseGenerator />} />
          <Route path="compositions" element={<CompositionList />} />
          <Route path="grading" element={<GradingWorkbench />} />
          <Route path="grading/:id" element={<GradingDetail />} />
          <Route path="analytics" element={<ClassAnalytics />} />
          <Route path="parent-sign" element={<ParentSignList />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<LicenseAdmin />} />
        </Route>

        {/* ── WAP 学生端 ── */}
        <Route path="/m/student" element={<MobileLayout title="知微教学" tabs={studentTabs} />}>
          <Route index element={<StudentAssignmentList />} />
          <Route path=":id" element={<StudentAnswerPage />} />
          <Route path="grading/:id" element={<StudentGradingView />} />
          <Route path="error-book" element={<StudentErrorBook />} />
        </Route>

        {/* ── WAP 家长端 ── */}
        <Route path="/m/parent" element={<MobileLayout title="知微家校" tabs={parentTabs} />}>
          <Route index element={<ParentAssignmentList />} />
          <Route path="sign/:id" element={<ParentSignPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
