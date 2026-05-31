import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/ui/Sidebar';
import { Header } from '../components/ui/Header';

const MainLayout = () => {
  return (
    <div className="flex min-h-screen bg-surface font-body antialiased">
      <Sidebar />
      <div className="flex-1 md:ml-64 min-w-0">
        <Header />
        <main className="px-3 sm:px-4 md:p-container-padding pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
