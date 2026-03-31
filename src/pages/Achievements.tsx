import { useGame } from '@/context/GameContext';
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1 },
};

export default function Achievements() {
  const { state } = useGame();
  const unlocked = state.achievements.filter(a => a.unlockedAt);
  const locked = state.achievements.filter(a => !a.unlockedAt);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Achievements 🏆</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {unlocked.length}/{state.achievements.length} unlocked
        </p>
      </div>

      {unlocked.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-lg mb-3">Unlocked</h2>
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {unlocked.map(a => (
              <motion.div key={a.id} variants={item} className="glass-card p-4 text-center">
                <span className="text-4xl block mb-2">{a.icon}</span>
                <p className="font-display font-bold text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-lg mb-3 text-muted-foreground">Locked</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {locked.map(a => (
              <div key={a.id} className="glass-card p-4 text-center opacity-40 grayscale">
                <span className="text-4xl block mb-2">{a.icon}</span>
                <p className="font-display font-bold text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground">???</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
