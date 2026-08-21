import { RatingDisplay } from '../RatingDisplay';

export default function RatingDisplayExample() {
  return (
    <RatingDisplay 
      audienceScore={7.8}
      criticScore={72}
      voteCount={15420}
      size="md"
    />
  );
}
