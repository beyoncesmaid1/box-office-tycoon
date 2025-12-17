import actionPoster from '@assets/generated_images/action_movie_poster_explosion.png';
import actionPoster2 from '@assets/generated_images/action_poster_-_car_chase_neon.png';
import actionPoster3 from '@assets/generated_images/action_poster_-_military_tactical.png';

import comedyPoster from '@assets/generated_images/comedy_movie_poster_bright.png';
import comedyPoster2 from '@assets/generated_images/comedy_poster_-_pastel_vibrant.png';
import comedyPoster3 from '@assets/generated_images/comedy_poster_-_slapstick_humor.png';

import dramaPoster from '@assets/generated_images/drama_movie_poster_emotional.png';
import dramaPoster2 from '@assets/generated_images/drama_poster_-_intimate_melancholic.png';
import dramaPoster3 from '@assets/generated_images/drama_poster_-_solitary_landscape.png';

import horrorPoster from '@assets/generated_images/horror_movie_poster_creepy.png';
import horrorPoster2 from '@assets/generated_images/horror_poster_-_creature_monster.png';
import horrorPoster3 from '@assets/generated_images/horror_poster_-_haunted_house.png';

import scifiPoster from '@assets/generated_images/sci-fi_movie_poster_futuristic.png';
import scifiPoster2 from '@assets/generated_images/sci-fi_poster_-_alien_spacecraft.png';
import scifiPoster3 from '@assets/generated_images/sci-fi_poster_-_cyborg_cyberpunk.png';

import romancePoster from '@assets/generated_images/romance_movie_poster_sunset.png';
import romancePoster2 from '@assets/generated_images/romance_poster_-_elegant_ballroom.png';
import romancePoster3 from '@assets/generated_images/romance_poster_-_beach_sunset.png';

import thrillerPoster from '@assets/generated_images/thriller_movie_poster_noir.png';
import thrillerPoster2 from '@assets/generated_images/thriller_poster_-_shadowy_tension.png';
import thrillerPoster3 from '@assets/generated_images/thriller_poster_-_chase_adrenaline.png';

import animationPoster from '@assets/generated_images/animation_movie_poster_colorful.png';
import animationPoster2 from '@assets/generated_images/animation_poster_-_colorful_whimsical.png';
import animationPoster3 from '@assets/generated_images/animation_poster_-_enchanted_forest.png';


export const genrePosters: Record<string, string[]> = {
  action: [actionPoster, actionPoster2, actionPoster3],
  comedy: [comedyPoster, comedyPoster2, comedyPoster3],
  drama: [dramaPoster, dramaPoster2, dramaPoster3],
  horror: [horrorPoster, horrorPoster2, horrorPoster3],
  scifi: [scifiPoster, scifiPoster2, scifiPoster3],
  romance: [romancePoster, romancePoster2, romancePoster3],
  thriller: [thrillerPoster, thrillerPoster2, thrillerPoster3],
  animation: [animationPoster, animationPoster2, animationPoster3],
};

export function getGenrePoster(genre: string): string {
  const posters = genrePosters[genre] || genrePosters['drama'];
  return posters[Math.floor(Math.random() * posters.length)];
}
