import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { StaffLayout } from './components/staff/StaffLayout';
import { GuestOnly, RequireRole } from './components/auth/RouteGuards';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StudentLayout } from './components/student/StudentLayout';
import {
  StudentApplicationsPage,
  StudentDocumentsPage,
  StudentFundingPage,
  StudentMessagesPage,
  StudentOverviewPage,
  StudentSessionsPage,
  StudentTravelPage,
} from './pages/student/StudentPages';
import { NotFoundPage } from './pages/NotFoundPage';
import { StaffLoginPage } from './pages/staff/StaffLoginPage';
import { StaffSetupPage } from './pages/staff/StaffSetupPage';
import { ErrorToast } from './components/ui/ErrorToast';
import { TodayPage } from './pages/staff/TodayPage';
import { SchedulePage } from './pages/staff/SchedulePage';
import { LeadsPage } from './pages/staff/LeadsPage';
import { StudentsPage } from './pages/staff/StudentsPage';
import { StudentRecordPage } from './pages/staff/StudentRecordPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AssignCounsellorsPage } from './pages/admin/AssignCounsellorsPage';
import { StaffUsersPage } from './pages/admin/StaffUsersPage';
import { AgenciesPage } from './pages/admin/AgenciesPage';
import { SettingsPage } from './pages/admin/SettingsPage';

const router = createBrowserRouter([
  // Public website
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  // Student login and registration (one-time code)
  {
    element: <Layout hideFooter />,
    children: [
      { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: '/register', element: <GuestOnly><RegisterPage /></GuestOnly> },
    ],
  },
  // Student portal
  {
    element: <Layout />,
    children: [
      {
        path: '/dashboard',
        element: <RequireRole roles={['student', 'parent']}><StudentLayout /></RequireRole>,
        children: [
          { index: true, element: <StudentOverviewPage /> },
          { path: 'applications', element: <StudentApplicationsPage /> },
          { path: 'documents', element: <StudentDocumentsPage /> },
          { path: 'sessions', element: <StudentSessionsPage /> },
          { path: 'messages', element: <StudentMessagesPage /> },
          { path: 'funding', element: <StudentFundingPage /> },
          { path: 'travel', element: <StudentTravelPage /> },
        ],
      },
    ],
  },
  // Staff sign-in (password + authenticator)
  { path: '/staff/login', element: <GuestOnly><StaffLoginPage /></GuestOnly> },
  // New staff: set a password and an authenticator app from the invitation link
  { path: '/staff/setup/:token', element: <GuestOnly><StaffSetupPage /></GuestOnly> },
  // Counsellor area (admins can use it too)
  {
    element: <RequireRole roles={['counsellor', 'officer', 'finance_officer', 'visa_officer', 'admin']}><StaffLayout /></RequireRole>,
    children: [
      { path: '/staff', element: <TodayPage /> },
      { path: '/staff/schedule', element: <SchedulePage /> },
      { path: '/staff/leads', element: <LeadsPage /> },
      { path: '/staff/students', element: <StudentsPage /> },
      { path: '/staff/students/:id', element: <StudentRecordPage /> },
    ],
  },
  // Admin area
  {
    element: <RequireRole roles={['admin']}><StaffLayout /></RequireRole>,
    children: [
      { path: '/admin', element: <AdminOverviewPage /> },
      { path: '/admin/assign', element: <AssignCounsellorsPage /> },
      { path: '/admin/users', element: <StaffUsersPage /> },
      { path: '/admin/agencies', element: <AgenciesPage /> },
      { path: '/admin/settings', element: <SettingsPage /> },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <ErrorToast />
    </AuthProvider>
  );
}
