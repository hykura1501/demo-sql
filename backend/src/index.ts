import express from 'express';
import cors from 'cors';
import queryRoutes from './routes/queryRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', queryRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'RunSQL Backend API', version: '1.0.0' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

