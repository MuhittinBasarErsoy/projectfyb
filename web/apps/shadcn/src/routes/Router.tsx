import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import Loadable from '../layouts/full/shared/loadable/Loadable';
import RequireAuth from '../views/fyblue/RequireAuth';

/* ***Layouts**** */
const FullLayout = Loadable(lazy(() => import('../layouts/full/FullLayout')));
const BlankLayout = Loadable(lazy(() => import('../layouts/blank/BlankLayout')));

// FyBlue sayfaları
const Overview = Loadable(lazy(() => import('../views/fyblue/Overview')));
const Query = Loadable(lazy(() => import('../views/fyblue/osos/Query')));
const History = Loadable(lazy(() => import('../views/fyblue/osos/History')));
const Jobs = Loadable(lazy(() => import('../views/fyblue/osos/Jobs')));
const Weather = Loadable(lazy(() => import('../views/fyblue/osos/Weather')));
const EpiasDashboard = Loadable(lazy(() => import('../views/fyblue/epias/Dashboard')));
const Endpoints = Loadable(lazy(() => import('../views/fyblue/epias/Endpoints')));
const EndpointDetail = Loadable(lazy(() => import('../views/fyblue/epias/EndpointDetail')));
const Formulas = Loadable(lazy(() => import('../views/fyblue/epias/Formulas')));
const Connections = Loadable(lazy(() => import('../views/fyblue/settings/Connections')));
const Profile = Loadable(lazy(() => import('../views/fyblue/settings/Profile')));

const Error = Loadable(lazy(() => import('../views/auth/error')));

// authentication
const Login2 = Loadable(lazy(() => import('../views/auth/auth2/login')));
const Register2 = Loadable(lazy(() => import('../views/auth/auth2/register')));

const Router = [
  {
    path: '/',
    element: (
      <RequireAuth>
        <FullLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <Overview /> },

      { path: '/osos/query', element: <Query /> },
      { path: '/osos/history', element: <History /> },
      { path: '/osos/jobs', element: <Jobs /> },
      { path: '/osos/weather', element: <Weather /> },

      { path: '/epias', element: <EpiasDashboard /> },
      { path: '/epias/endpoints', element: <Endpoints /> },
      { path: '/epias/endpoints/:key', element: <EndpointDetail /> },
      { path: '/epias/formulas', element: <Formulas /> },

      { path: '/settings/connections', element: <Connections /> },
      { path: '/settings/profile', element: <Profile /> },
    ],
  },
  {
    path: '/',
    element: <BlankLayout />,
    children: [
      { path: '/signin', element: <Login2 /> },
      { path: '/signup', element: <Register2 /> },
      { path: '*', element: <Error /> },
    ],
  },
];

const router = createBrowserRouter(Router, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') });

export default router;
