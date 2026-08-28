import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import LoginPage from './pages/LoginPage'
import TeacherDashboard from './pages/TeacherDashboard'
import RequireSchoolLicense from './components/RequireSchoolLicense'

const LessonPlanList = lazy(() => import('./pages/LessonPlanList'))
const LessonPlanEditor = lazy(() => import('./pages/LessonPlanEditor'))
const Materials = lazy(() => import('./pages/Materials'))
const CoursewareBuilder = lazy(() => import('./pages/CoursewareBuilder'))
const CoursewareList = lazy(() => import('./pages/CoursewareList'))
const Exercises = lazy(() => import('./pages/Exercises'))
const ExerciseGenerator = lazy(() => import('./pages/ExerciseGenerator'))
const ExamList = lazy(() => import('./pages/ExamList'))
const ExamBuilder = lazy(() => import('./pages/ExamBuilder'))
const SheetBuilder = lazy(() => import('./pages/SheetBuilder'))
const AssignmentList = lazy(() => import('./pages/AssignmentList'))
const AssignmentBuilder = lazy(() => import('./pages/AssignmentBuilder'))
const AssignmentEditor = lazy(() => import('./pages/AssignmentEditor'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const GradingPage = lazy(() => import('./pages/GradingPage'))
const GrowthPage = lazy(() => import('./pages/GrowthPage'))
const CarePage = lazy(() => import('./pages/CarePage'))
const CareDetail = lazy(() => import('./pages/CareDetail'))
const ParentSignPage = lazy(() => import('./pages/ParentSignPage'))
const PublishedLessons = lazy(() => import('./pages/PublishedLessons'))
const ReviewPool = lazy(() => import('./pages/ReviewPool'))
const ClassSwitchPage = lazy(() => import('./pages/ClassSwitchPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ITAdminPage = lazy(() => import('./pages/ITAdminPage'))
const PrincipalPage = lazy(() => import('./pages/PrincipalPage'))
const FacetAdmin = lazy(() => import('./pages/FacetAdmin'))

const Loading = () => <div className="flex items-center justify-center h-screen bg-[#F6F7F8]"><div className="w-8 h-8 border-4 border-[#02A7F0]/20 border-t-[#02A7F0] rounded-full animate-spin" /></div>

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/lesson-plans" element={<Suspense fallback={<Loading />}><LessonPlanList /></Suspense>} />
        <Route path="/lesson-plans/new" element={<Suspense fallback={<Loading />}><LessonPlanEditor /></Suspense>} />
        <Route path="/lesson-plans/:id/view" element={<Suspense fallback={<Loading />}><LessonPlanEditor /></Suspense>} />
        <Route path="/lesson-plans/:id/edit" element={<Suspense fallback={<Loading />}><LessonPlanEditor /></Suspense>} />
        <Route path="/lesson-plans/:id" element={<Suspense fallback={<Loading />}><LessonPlanEditor /></Suspense>} />
        <Route path="/materials" element={<Suspense fallback={<Loading />}><Materials /></Suspense>} />
        <Route path="/courseware/ppt" element={<Suspense fallback={<Loading />}><CoursewareList format="ppt" /></Suspense>} />
        <Route path="/courseware/h5" element={<Suspense fallback={<Loading />}><CoursewareList format="h5" /></Suspense>} />
        <Route path="/courseware/video" element={<Suspense fallback={<Loading />}><CoursewareList format="video" /></Suspense>} />
        <Route path="/courseware/:format/new" element={<Suspense fallback={<Loading />}><CoursewareBuilder /></Suspense>} />
        <Route path="/courseware/:format/:id" element={<Suspense fallback={<Loading />}><CoursewareBuilder /></Suspense>} />
        <Route path="/courseware/:format/:id/edit" element={<Suspense fallback={<Loading />}><CoursewareBuilder /></Suspense>} />
        <Route path="/exercises" element={<Suspense fallback={<Loading />}><Exercises /></Suspense>} />
        <Route path="/exercises/new" element={<Suspense fallback={<Loading />}><ExerciseGenerator /></Suspense>} />
        <Route path="/exercises/:id/edit" element={<Suspense fallback={<Loading />}><ExerciseGenerator /></Suspense>} />
        <Route path="/exercises/:id" element={<Suspense fallback={<Loading />}><ExerciseGenerator /></Suspense>} />
        <Route path="/exams" element={<Suspense fallback={<Loading />}><ExamList /></Suspense>} />
        <Route path="/exams/new" element={<Suspense fallback={<Loading />}><ExamBuilder /></Suspense>} />
        <Route path="/exams/:id/edit" element={<Suspense fallback={<Loading />}><ExamBuilder /></Suspense>} />
        <Route path="/exams/:id" element={<Suspense fallback={<Loading />}><ExamBuilder /></Suspense>} />
        <Route path="/sheets/new" element={<Suspense fallback={<Loading />}><SheetBuilder /></Suspense>} />
        <Route path="/sheets/:id/edit" element={<Suspense fallback={<Loading />}><SheetBuilder /></Suspense>} />
        <Route path="/sheets/:id" element={<Suspense fallback={<Loading />}><SheetBuilder /></Suspense>} />
        <Route path="/assignments" element={<Suspense fallback={<Loading />}><AssignmentList /></Suspense>} />
        <Route path="/assignments/new" element={<Suspense fallback={<Loading />}><AssignmentBuilder /></Suspense>} />
        <Route path="/assignments/:id/edit" element={<Suspense fallback={<Loading />}><AssignmentEditor /></Suspense>} />
        <Route path="/assignments/:id" element={<Suspense fallback={<Loading />}><AssignmentEditor /></Suspense>} />
        <Route path="/analytics" element={<Suspense fallback={<Loading />}><AnalyticsPage /></Suspense>} />
        <Route path="/grading" element={<Suspense fallback={<Loading />}><GradingPage /></Suspense>} />
        <Route path="/growth" element={<Suspense fallback={<Loading />}><GrowthPage /></Suspense>} />
        <Route path="/care" element={<Suspense fallback={<Loading />}><CarePage /></Suspense>} />
        <Route path="/care/:id" element={<Suspense fallback={<Loading />}><CareDetail /></Suspense>} />
        <Route path="/parent-sign" element={<Suspense fallback={<Loading />}><ParentSignPage /></Suspense>} />
        <Route path="/published-lessons" element={<Suspense fallback={<Loading />}><PublishedLessons /></Suspense>} />
        <Route path="/review-pool" element={<Suspense fallback={<Loading />}><ReviewPool /></Suspense>} />
        <Route path="/facet-admin" element={<Suspense fallback={<Loading />}><FacetAdmin /></Suspense>} />
        <Route path="/classes" element={<Suspense fallback={<Loading />}><ClassSwitchPage /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<Loading />}><SettingsPage /></Suspense>} />
        <Route path="/it-admin" element={<Suspense fallback={<Loading />}><ITAdminPage /></Suspense>} />
        <Route path="/principal" element={<Suspense fallback={<Loading />}><PrincipalPage /></Suspense>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}
