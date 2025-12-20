import { useRoute } from 'wouter';
import { FilmDetail } from '@/components/FilmDetail';

export default function FilmDetailPage() {
  const [, params] = useRoute('/film/:filmId');
  const filmId = params?.filmId || '';

  return (
    <div className="p-6">
      <FilmDetail filmId={filmId} />
    </div>
  );
}
