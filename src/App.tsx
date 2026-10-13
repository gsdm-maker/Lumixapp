import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from '@core/auth/context/AuthContext'
import { ThemeProvider } from '@core/theme/ThemeContext'
import { NotificationProvider } from '@core/notifications/NotificationContext'
import { AppLayout } from '@shared/components/layout/AppLayout'
import { ErrorBoundary } from '@shared/components/ErrorBoundary'
import { ToastProvider } from '@shared/components/ui/Toast'
import { ConfirmProvider } from '@shared/components/ui/ConfirmDialog'
import { Spinner } from '@shared/components/ui/Spinner'
import { AuthGuard } from '@core/auth/components/AuthGuard'
import { ModuloGuard } from '@core/auth/components/ModuloGuard'

const ChatPage = lazy(() =>
  import('@features/chat/components/ChatPage').then((m) => ({ default: m.ChatPage })),
)
const ActivitiesPage = lazy(() =>
  import('@features/activities/components/ActivitiesPage').then((m) => ({
    default: m.ActivitiesPage,
  })),
)
const ErrorsPage = lazy(() =>
  import('@features/errors/components/ErrorsPage').then((m) => ({ default: m.ErrorsPage })),
)
const MinutaPage = lazy(() =>
  import('@features/minuta/components/MinutaPage').then((m) => ({ default: m.MinutaPage })),
)
const ProyectosPage = lazy(() =>
  import('@features/proyectos/components/ProyectosPage').then((m) => ({
    default: m.ProyectosPage,
  })),
)
const ProyectoDetailPage = lazy(() =>
  import('@features/proyectos/components/ProyectoDetailPage').then((m) => ({
    default: m.ProyectoDetailPage,
  })),
)
const CompromisosPage = lazy(() =>
  import('@features/compromisos/components/CompromisosPage').then((m) => ({
    default: m.CompromisosPage,
  })),
)
const NotificationsPage = lazy(() =>
  import('@features/notifications/components/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
)
const TeamsPage = lazy(() =>
  import('@features/teams/components/TeamsPage').then((m) => ({ default: m.TeamsPage })),
)
const AdminLayout = lazy(() =>
  import('@features/admin/components/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const PersonasAdmin = lazy(() =>
  import('@features/admin/components/PersonasPage').then((m) => ({ default: m.PersonasPage })),
)
const EstructuraAdmin = lazy(() =>
  import('@features/admin/components/EstructuraPage').then((m) => ({
    default: m.EstructuraPage,
  })),
)
const GuiaAdmin = lazy(() =>
  import('@features/admin/components/GuiaAdminPage').then((m) => ({ default: m.GuiaAdminPage })),
)
const EmpresasAdmin = lazy(() =>
  import('@features/admin/components/EmpresasPage').then((m) => ({ default: m.EmpresasPage })),
)
const ActividadAdmin = lazy(() =>
  import('@features/admin/components/ActividadPage').then((m) => ({ default: m.ActividadPage })),
)
const BienvenidaPage = lazy(() =>
  import('@core/auth/components/BienvenidaPage').then((m) => ({ default: m.BienvenidaPage })),
)
const ElegirEntrada = lazy(() =>
  import('@core/auth/components/ElegirEntrada').then((m) => ({ default: m.ElegirEntrada })),
)
const IngestasTabs = lazy(() =>
  import('@features/ingestas/components/IngestasTabs').then((m) => ({ default: m.IngestasTabs })),
)
const DashboardPage = lazy(() =>
  import('@features/dashboard/components/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
)
const GanttPage = lazy(() =>
  import('@features/gantt/components/GanttPage').then((m) => ({ default: m.GanttPage })),
)
const LoginPage = lazy(() =>
  import('@core/auth/components/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const ChangePasswordPage = lazy(() =>
  import('@core/auth/components/ChangePasswordPage').then((m) => ({
    default: m.ChangePasswordPage,
  })),
)
const GuiaPage = lazy(() =>
  import('@features/guia/components/GuiaPage').then((m) => ({ default: m.GuiaPage })),
)
const ProfilePage = lazy(() =>
  import('@features/profile/components/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full text-fg-faint">
      <Spinner size={20} />
    </div>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          {/* Orden: ToastProvider afuera porque NotificationProvider avisa con un toast.
            NotificationProvider DENTRO del router porque relee las notificaciones en cada
            cambio de ruta (necesita useLocation). */}
          <ToastProvider>
            <ConfirmProvider>
              <BrowserRouter>
                <NotificationProvider>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/change-password" element={<ChangePasswordPage />} />
                      <Route path="/bienvenida" element={<BienvenidaPage />} />
                      <Route
                        path="/entrar"
                        element={
                          <AuthGuard>
                            <ElegirEntrada />
                          </AuthGuard>
                        }
                      />
                      {/* Consola de administracion: fuera de AppLayout, con su propio menu. */}
                      <Route
                        path="/admin"
                        element={
                          <AuthGuard>
                            <AdminLayout />
                          </AuthGuard>
                        }
                      >
                        <Route index element={<PersonasAdmin />} />
                        <Route path="estructura" element={<EstructuraAdmin />} />
                        <Route path="empresas" element={<EmpresasAdmin />} />
                        <Route path="guia" element={<GuiaAdmin />} />
                        {/* Ruta anterior de la pagina de unidades. */}
                        <Route
                          path="equipos"
                          element={<Navigate to="/admin/estructura" replace />}
                        />
                        <Route path="actividad" element={<ActividadAdmin />} />
                      </Route>
                      <Route
                        element={
                          <AuthGuard>
                            <AppLayout />
                          </AuthGuard>
                        }
                      >
                        <Route path="/chat" element={<ChatPage />} />
                        <Route
                          path="/activities"
                          element={
                            <ModuloGuard cap="modulos.actividades">
                              <ActivitiesPage />
                            </ModuloGuard>
                          }
                        />
                        <Route
                          path="/minuta"
                          element={
                            <ModuloGuard cap="modulos.minuta">
                              <MinutaPage />
                            </ModuloGuard>
                          }
                        />
                        <Route
                          path="/proyectos"
                          element={
                            <ModuloGuard cap="modulos.proyectos">
                              <ProyectosPage />
                            </ModuloGuard>
                          }
                        />
                        <Route
                          path="/proyectos/:id"
                          element={
                            <ModuloGuard cap="modulos.proyectos">
                              <ProyectoDetailPage />
                            </ModuloGuard>
                          }
                        />
                        <Route
                          path="/compromisos"
                          element={
                            <ModuloGuard cap="modulos.compromisos">
                              <CompromisosPage />
                            </ModuloGuard>
                          }
                        />
                        <Route
                          path="/errors"
                          element={
                            <ModuloGuard cap="modulos.errores">
                              <ErrorsPage />
                            </ModuloGuard>
                          }
                        />
                        <Route
                          path="/dashboard"
                          element={
                            <ModuloGuard cap="modulos.dashboard">
                              <DashboardPage />
                            </ModuloGuard>
                          }
                        />
                        <Route
                          path="/gantt"
                          element={
                            <ModuloGuard cap="modulos.planificacion">
                              <GanttPage />
                            </ModuloGuard>
                          }
                        />
                        <Route path="/notifications" element={<NotificationsPage />} />
                        <Route path="/teams" element={<TeamsPage />} />
                        <Route
                          path="/ingestas"
                          element={
                            <ModuloGuard cap="modulos.ingestas">
                              <IngestasTabs />
                            </ModuloGuard>
                          }
                        />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/guia" element={<GuiaPage />} />
                        <Route path="*" element={<Navigate to="/chat" replace />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </NotificationProvider>
              </BrowserRouter>
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
