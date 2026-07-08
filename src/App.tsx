import React, { useEffect, useState } from 'react';
import { SpreadsheetInfo, UserSession } from './types';
import Dashboard from './components/Dashboard';

export default function App() {
  // Directly default to an authenticated Admin session pointing to the continuous Apps Script database
  const [session] = useState<UserSession | null>({
    role: 'admin',
    displayName: 'Admin Utama',
    email: 'admin@workspace.com',
    photoURL: '',
  });
  
  const [token] = useState<string | null>('mock_apps_script_token');
  
  const [spreadsheet] = useState<SpreadsheetInfo | null>({
    id: 'apps_script_db',
    name: 'Database Utama (Apps Script)',
    webViewLink: '#'
  });

  // Display the admin dashboard directly
  return (
    <Dashboard
      session={session!}
      token={token!}
      spreadsheet={spreadsheet!}
      onLogout={() => {
        // Since we are forcing Direct Admin Access, logging out will simply refresh or clear local states
        localStorage.clear();
        window.location.reload();
      }}
      onChangeSpreadsheet={() => {
        // Bypassed as per user intent
        console.log('Direct Admin Mode Active. Sheet configuration is bypassed.');
      }}
    />
  );
}
