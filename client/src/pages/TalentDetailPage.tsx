import { useRoute } from 'wouter';
import { TalentDetail } from '@/components/TalentDetail';

export default function TalentDetailPage() {
  const [, params] = useRoute('/talent/:talentId');
  const talentId = params?.talentId || '';

  return (
    <div className="p-6">
      <TalentDetail talentId={talentId} />
    </div>
  );
}
