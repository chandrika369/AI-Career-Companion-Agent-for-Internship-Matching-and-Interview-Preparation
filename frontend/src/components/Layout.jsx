import React from 'react'
import Sidebar from './Sidebar'
import ChatWidget from './ChatWidget'

export default function Layout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
        marginLeft: 232, flex: 1, padding: '36px 40px',
        minHeight: '100vh', background: 'var(--bg)',
      }}>
        {children}
      </main>
      <ChatWidget />
    </div>
  )
}
