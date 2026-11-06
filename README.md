# ElectroHub Frontend

React/Vite user interface for the ElectroHub shop-management app. The backend is in a separate repository. For local development, clone the companion backend into a sibling folder named `backend`:

```cmd
mkdir ElectroHub
cd ElectroHub
git clone https://github.com/fezu22/Electoniki-F.git frontend
git clone https://github.com/fezu22/Electoniki-B.git backend
```

Set up the backend first using `backend/README.md` and `backend/.env.example`. Then open two terminals:

```cmd
cd ElectroHub\backend
npm install
npm run dev
```

```cmd
cd ElectroHub\frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite server proxies `/api` to `http://127.0.0.1:<PORT>` using the `PORT` in the sibling `backend/.env` (default `3000`). Keep both processes running. Backend secrets belong only in `backend/.env`; do not put them in frontend files or commit them.

Build the production UI with `npm run build`. The built files go into `frontend/dist`; the backend serves that directory when `NODE_ENV=production`.
