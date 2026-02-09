import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Book, Heart, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { useAuth } from '@/features/auth/model/authContext';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [readingGoal, setReadingGoal] = useState(12);
  const [isLoading, setIsLoading] = useState(false);

  const genres = [
    'Literary Fiction', 'Mystery', 'Sci-Fi', 'Fantasy', 'Romance',
    'Thriller', 'History', 'Biography', 'Poetry', 'Self-Help',
    'Cooking', 'Art', 'Travel', 'Nature',
  ];

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const nextStep = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      setIsLoading(true);
      try {
        await completeOnboarding(selectedGenres, readingGoal);
        navigate('/');
      } catch {
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-linen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center gap-4 mb-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <motion.div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                  step >= i
                    ? 'bg-amber border-amber text-brown-dark'
                    : 'bg-transparent border-brown/20 text-brown/40'
                }`}
                animate={{ scale: step === i ? 1.1 : 1 }}
              >
                {i === 1 && <Book size={20} />}
                {i === 2 && <Heart size={20} />}
                {i === 3 && <Sparkles size={20} />}
              </motion.div>
              <div
                className={`h-1 w-16 rounded-full transition-colors ${
                  step >= i ? 'bg-amber' : 'bg-brown/10'
                }`}
              />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-cream p-8 rounded-2xl shadow-warm border border-white/50"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-serif font-bold text-brown mb-2">
                  What do you love to read?
                </h2>
                <p className="text-brown/60">Select a few genres to help us stock your shelves.</p>
              </div>

              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {genres.map((genre) => (
                  <Badge
                    key={genre}
                    variant={selectedGenres.includes(genre) ? 'amber' : 'default'}
                    onClick={() => toggleGenre(genre)}
                    selected={selectedGenres.includes(genre)}
                    className="text-base px-4 py-2 cursor-pointer"
                  >
                    {genre}
                  </Badge>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={nextStep}
                  rightIcon={<ArrowRight size={16} />}
                  disabled={selectedGenres.length === 0}
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-cream p-8 rounded-2xl shadow-warm border border-white/50"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-serif font-bold text-brown mb-2">
                  Set a Reading Goal
                </h2>
                <p className="text-brown/60">How many books do you want to read this year?</p>
              </div>

              <div className="flex flex-col items-center mb-10">
                <div className="relative w-full max-w-md mb-8">
                  <div className="text-6xl font-serif font-bold text-brown text-center mb-4">
                    {readingGoal}
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={readingGoal}
                    onChange={(e) => setReadingGoal(parseInt(e.target.value))}
                    className="w-full h-2 bg-brown/10 rounded-lg appearance-none cursor-pointer accent-amber"
                  />
                </div>

                <motion.div
                  key={readingGoal > 50 ? 'high' : readingGoal > 20 ? 'med' : 'low'}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-lg font-medium text-amber-700"
                >
                  {readingGoal > 50
                    ? 'Wow! A true bookworm!'
                    : readingGoal > 20
                      ? "That's a great challenge!"
                      : 'A cozy pace for the year.'}
                </motion.div>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={nextStep} rightIcon={<ArrowRight size={16} />}>
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-cream p-8 rounded-2xl shadow-warm border border-white/50 text-center"
            >
              <div className="mb-8">
                <div className="text-6xl mb-4">
                  <Sparkles className="inline text-amber w-16 h-16" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-brown mb-2">
                  You're All Set!
                </h2>
                <p className="text-brown/60 text-lg">
                  We've personalized your shelves based on your preferences.
                  <br />
                  Enjoy your reading journey!
                </p>
              </div>

              <div className="mb-8 p-4 bg-amber/10 rounded-xl border border-amber/20">
                <p className="text-sm text-brown/70 mb-1">Your genres:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {selectedGenres.map((g) => (
                    <Badge key={g} variant="amber">{g}</Badge>
                  ))}
                </div>
                <p className="text-sm text-brown/70 mt-3">
                  Reading goal: <span className="font-bold">{readingGoal} books</span>
                </p>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button
                  onClick={nextStep}
                  variant="wood"
                  size="lg"
                  isLoading={isLoading}
                >
                  Start My Journey
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
