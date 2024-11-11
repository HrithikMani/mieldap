import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import KubernetesCluster from './pages/KubernetesCluster';
import VirtualMachine from './pages/VirtualMachine';

// Sidebar component with links to switch between pages
function Sidebar() {
  return (
    <aside style={{ width: '200px', padding: '20px', backgroundColor: '#f4f4f4', height: '100vh' }}>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li><Link to="/kubernetes-cluster">Kubernetes Cluster</Link></li>
        <li><Link to="/vm">Virtual Machine</Link></li>
      </ul>
    </aside>
  );
}

function App() {
  return (
    <Router>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ marginLeft: '200px', padding: '20px', width: '100%' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/vm" replace />} />
            <Route path="/kubernetes-cluster" element={<KubernetesCluster />} />
            <Route path="/vm" element={<VirtualMachine />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
