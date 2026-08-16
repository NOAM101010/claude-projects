import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GameButton } from '@/components/ui/GameButton';
import { useT } from '@/hooks/useT';

export default function NotFoundScene() {
  const navigate = useNavigate();
  const { t } = useT();
  return (
    <motion.div className="min-h-[100dvh] grid place-items-center px-6 vignette"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="text-center">
        <div className="text-[54px] mb-3 ambient-float">🚪</div>
        <h2>{t('errors.notFound')}</h2>
        <GameButton tone="gold" className="mt-5" onClick={() => navigate('/hub')}>{t('errors.goHub')}</GameButton>
      </div>
    </motion.div>
  );
}
