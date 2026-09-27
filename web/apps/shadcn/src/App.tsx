import { rememberTemplate } from '@fyblue/core';
import { RouterProvider } from 'react-router';
import router from './routes/Router';
import './css/globals.css';

// Bu şablon açıldıysa kullanıcı onu seçmiştir; kök adres (/) bir dahaki sefere buraya yönlenir.
rememberTemplate('shadcn');

function App() {
  return <RouterProvider router={router} />;
}

export default App;
