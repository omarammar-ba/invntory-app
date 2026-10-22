import React from 'react';

export default function StartupScreen({ message, slow = false }: { message: string; slow?: boolean }) {
  return <div className="startup-screen app-viewport" dir="rtl" role="status" aria-live="polite">
    <div className="startup-content"><img src="/icons/icon-192.png" width="84" height="84" alt="شعار إدارة مخزون" /><h1>إدارة مخزون</h1>
      <p>{slow ? 'الاتصال يأخذ وقتًا أطول من المعتاد…' : message}</p><span className="startup-progress" aria-hidden="true"><span /></span>
      {slow && <button type="button" onClick={() => window.location.reload()}>إعادة المحاولة</button>}
    </div>
    <img className="startup-credit" src="/branding/dollarix-studio-color.png" alt="Dollarix Studio" />
  </div>;
}
