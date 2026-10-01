import React from 'react';

interface PageHeaderProps {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, sub, actions }: PageHeaderProps) {
  return (
    <header className="page-header row-between">
      <div>
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}
