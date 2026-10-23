import React from 'react';
import { createRoot } from 'react-dom/client';
import InvoiceDesignPreview from './InvoiceDesignPreview.jsx';
import '../index.css';

const kind = new URLSearchParams(window.location.search).get('kind');
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <InvoiceDesignPreview kind={kind === 'installment' ? 'installment' : 'sales'} />
  </React.StrictMode>,
);
