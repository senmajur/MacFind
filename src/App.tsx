import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { LostPage } from './pages/Lost';
import { FoundPage } from './pages/Found';
import { ItemDetailPage } from './pages/ItemDetail';
import { ChatPage } from './pages/ChatPage';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/lost" element={<LostPage />} />
                <Route path="/found" element={<FoundPage />} />
                <Route path="/items/:id" element={<ItemDetailPage />} />
                <Route path="/chat/:itemId/:otherUserId" element={<ChatPage />} />
              </Routes>
            </Layout>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}


export default App;
