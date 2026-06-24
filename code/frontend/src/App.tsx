import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'

// 统一响应式布局
import DashboardLayout from './components/layout/DashboardLayout'

// PC 教师端页面
import DashboardHome from './pages/DashboardHome'
import LessonPlanList from './pages/LessonPlanList'
import LessonPlanEditor from './pages/LessonPlanEditor'
import ExerciseList from './pages/ExerciseList'
import ExerciseGenerator from './pages/ExerciseGenerator'
import QuestionBank from './pages/QuestionBank'
import CompositionList from './pages/CompositionList'
import GradingWorkbench from './pages/GradingWorkbench'
import GradingDetail from './pages/GradingDetail'
import ClassAnalytics from './pages/ClassAnalytics'
import ParentSignList from './pages/ParentSignList'
import SettingsPage from './pages/SettingsPage'
import LicenseAdmin from './pages/LicenseAdmin'
import ReviewList from './pages/ReviewList'
import ReviewDetail from './pages/ReviewDetail'
import PrincipalDashboard from './pages/PrincipalDashboard'

// 学生端页面（原 WAP，后续迁移至 pages/ 根目录）
import StudentAssignmentList from './pages/wap/StudentAssignmentList'
import StudentAnswerPage from './pages/wap/StudentAnswerPage'
import StudentGradingView from './pages/wap/StudentGradingView'
import StudentErrorBook from './pages/wap/StudentErrorBook'

// 家长端页面（原 WAP）
import ParentAssignmentList from './pages/wap/ParentAssignmentList'
import ParentSignPage from './pages/wap/ParentSignPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── 公开路由 ── */}
        <Route path="/login" element={<LoginPage />} />

        {/* ── 教师端（统一响应式布局）── */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="lesson-plans" element={<LessonPlanList />} />
          <Route path="lesson-plans/new" element={<LessonPlanEditor />} />
          <Route path="lesson-plans/:id/edit" element={<LessonPlanEditor />} />
          <Route path="exercises" element={<ExerciseList />} />
          <Route path="exercises/new" element={<ExerciseGenerator />} />
          <Route path="question-bank" element={<QuestionBank />} />
          <Route path="compositions" element={<CompositionList />} />
          <Route path="grading" element={<GradingWorkbench />} />
          <Route path="grading/:id" element={<GradingDetail />} />
          <Route path="analytics" element={<ClassAnalytics />} />
          <Route path="parent-sign" element={<ParentSignList />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<LicenseAdmin />} />
          <Route path="reviews" element={<ReviewList />} />
          <Route path="review/:id" element={<ReviewDetail />} />
          <Route path="principal" element={<PrincipalDashboard />} />
        </Route>

        {/* ── 学生端（统一响应式布局）── */}
        <Route path="/student" element={<DashboardLayout />}>
          <Route index element={<StudentAssignmentList />} />
          <Route path=":id" element={<StudentAnswerPage />} />
          <Route path="grading/:id" element={<StudentGradingView />} />
          <Route path="error-book" element={<StudentErrorBook />} />
        </Route>

        {/* ── 家长端（统一响应式布局）── */}
        <Route path="/parent" element={<DashboardLayout />}>
          <Route index element={<ParentAssignmentList />} />
          <Route path="sign/:id" element={<ParentSignPage />} />
        </Route>

        {/* ── 旧 WAP 路径 301 重定向 ── */}
        <Route path="/m/student" element={<Navigate to="/student" replace />} />
        <Route path="/m/student/*" element={<RedirectFromWap base="/m/student" to="/student" />} />
        <Route path="/m/parent" element={<Navigate to="/parent" replace />} />
        <Route path="/m/parent/*" element={<RedirectFromWap base="/m/parent" to="/parent" />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

/** WAP 旧路径重定向辅助组件 */
function RedirectFromWap({ base, to }: { base: string; to: string }) {
  const path = window.location.pathname
  const newPath = path.replace(base, to)
  return <Navigate to={newPath} replace />
}
