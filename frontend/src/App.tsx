import { useSyncExternalStore } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { FeedbackMode, feedbackEnabled } from './components/feedback/FeedbackMode';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { StaffLayout } from './components/staff/StaffLayout';
import { GuestOnly, RequireRole } from './components/auth/RouteGuards';
import { HomePage } from './pages/HomePage';
import { DelegateUploadPage } from './pages/DelegateUploadPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { StudentLayout } from './components/student/StudentLayout';
import {
  StudentApplicationsPage,
  StudentDocumentsPage,
  StudentFundingPage,
  StudentMessagesPage,
  StudentOverviewPage,
  StudentSessionsPage,
  StudentReferPage,
  StudentTravelPage,
} from './pages/student/StudentPages';
import { ProfilePage as StudentProfilePage } from './pages/student/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { StaffLoginPage } from './pages/staff/StaffLoginPage';
import { StaffSetupPage } from './pages/staff/StaffSetupPage';
import { ErrorToast } from './components/ui/ErrorToast';
import { ReferralsPage } from './pages/staff/ReferralsPage';
import { TodayPage } from './pages/staff/TodayPage';
import { SchedulePage } from './pages/staff/SchedulePage';
import { LeadsPage } from './pages/staff/LeadsPage';
import { StudentsPage } from './pages/staff/StudentsPage';
import { StudentRecordPage } from './pages/staff/StudentRecordPage';
import { MyProfilePage } from './pages/staff/MyProfilePage';
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
  // Student login (email and password), registration (email verified with a code) and forgot password
  {
    element: <Layout hideFooter />,
    children: [
      { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: '/register', element: <GuestOnly><RegisterPage /></GuestOnly> },
      { path: '/forgot-password', element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
    ],
  },
  // A parent or sponsor uploading from their private link (no account)
  {
    element: <Layout hideFooter />,
    children: [{ path: '/upload/:token', element: <DelegateUploadPage /> }],
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
          { path: 'refer', element: <StudentReferPage /> },
          { path: 'profile', element: <StudentProfilePage /> },
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
      { path: '/staff/profile', element: <MyProfilePage /> },
    ],
  },
  // Referrals: counsellors their own, admins everyone's
  {
    element: <RequireRole roles={['counsellor', 'admin']}><StaffLayout /></RequireRole>,
    children: [{ path: '/staff/referrals', element: <ReferralsPage /> }],
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

/** Temporary Feedback Mode, told which page is showing (it sits outside the router's pages). */
function Feedback() {
  const pathname = useSyncExternalStore(router.subscribe, () => router.state.location.pathname);
  return <FeedbackMode pathname={pathname} />;
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <ErrorToast />
      {feedbackEnabled && <Feedback />}
    </AuthProvider>
  );
}
