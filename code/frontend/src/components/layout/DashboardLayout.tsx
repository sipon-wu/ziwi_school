import { Outlet } from 'react-router-dom'
import SideBar from './SideBar'
import TopNavBar from './TopNavBar'
import XiaoWeiChat from '../XiaoWeiChat'
import DemoEnv from '../DemoEnv'

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-page">
      <SideBar />
      <div className="flex flex-1 flex-col min-w-0">
        <DemoEnv />
        <TopNavBar />
        <main className="flex-1 overflow-auto p-5">
          <Outlet />
        </main>
      </div>
      <XiaoWeiChat />
    </div>
  )
}
