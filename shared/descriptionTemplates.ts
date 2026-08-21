export const descriptionTemplates: Record<string, string[]> = {
  action: [
    "High-octane thrills await as {PROTAGONIST} must stop {ANTAGONIST} before {STAKES}. Packed with explosive set pieces and stunning choreography, featuring {TALENT1} and {TALENT2}.",
    "{PROTAGONIST} takes on the role of {ROLE} in this adrenaline-pumping adventure where every moment counts. With {TALENT1} leading the charge, watch as {STAKES}.",
    "When {STAKES}, {PROTAGONIST} must become the ultimate {ROLE} to save the day. Directed by {DIRECTOR}, featuring an all-star cast including {TALENT1}.",
  ],
  drama: [
    "A powerful character study following {PROTAGONIST}'s journey through {STAKES}. {TALENT1} delivers a career-defining performance, with support from {TALENT2} and {DIRECTOR}'s masterful direction.",
    "In this emotionally gripping tale, {PROTAGONIST} must confront {STAKES} while {ROLE} by {TALENT1} steals every scene. A meditation on the human condition that resonates deeply.",
    "From acclaimed director {DIRECTOR} comes the story of {PROTAGONIST}, whose life is forever changed when {STAKES}. Featuring {TALENT1}'s transformative performance.",
  ],
  comedy: [
    "{PROTAGONIST} finds themselves in hilariously impossible situations while trying to {STAKES}. {TALENT1} is absolutely brilliant, alongside {TALENT2}, in this laugh-out-loud adventure.",
    "When {PROTAGONIST} discovers {STAKES}, chaos ensues in the funniest ways imaginable. {TALENT1}'s impeccable timing and {TALENT2}'s comedic brilliance make this an instant classic.",
    "A delightfully absurd romp where {PROTAGONIST} must navigate {STAKES} with help from {ROLE} {TALENT1}. Director {DIRECTOR} brings perfect comedic balance to this hilarious gem.",
  ],
  horror: [
    "Terror strikes when {PROTAGONIST} awakens {ANTAGONIST} lurking in {STAKES}. As darkness closes in, {TALENT1}'s {ROLE} becomes humanity's last hope. A masterclass in sustained dread.",
    "{PROTAGONIST} and {TALENT1} face unspeakable horrors when they {STAKES}. Director {DIRECTOR} crafts a relentlessly terrifying experience that will haunt you long after the credits roll.",
    "In the depths of {STAKES}, {PROTAGONIST} discovers that {ANTAGONIST} is far more dangerous than anyone imagined. Starring {TALENT1} and featuring {TALENT2}'s breakthrough performance.",
  ],
  scifi: [
    "Set in a future where {STAKES}, {PROTAGONIST} must uncover the truth behind {ANTAGONIST}. With cutting-edge visuals and {TALENT1}'s compelling performance, this sci-fi epic challenges everything we know.",
    "{PROTAGONIST} discovers {STAKES} and becomes the only one who can stop {ANTAGONIST}. Directed by {DIRECTOR}, featuring {TALENT1}, {TALENT2}, and mind-bending spectacle.",
    "When {STAKES}, humanity's survival depends on {PROTAGONIST} and {TALENT1}'s ability to {ROLE}. A thrilling exploration of technology, identity, and what it means to be human.",
  ],
  romance: [
    "Against impossible odds, {PROTAGONIST} and {TALENT1} discover that love is {STAKES}. Their connection transcends everything as director {DIRECTOR} crafts a romance for the ages.",
    "{PROTAGONIST} never expected to fall for {TALENT1}, but when {STAKES}, their hearts have no choice. A sweeping romance featuring {TALENT2} and filled with unforgettable moments.",
    "From first meeting to passionate climax, {PROTAGONIST} and {TALENT1} navigate {STAKES} on their journey to find true love. Featuring {DIRECTOR}'s signature emotional depth.",
  ],
  animation: [
    "In a vibrant world where {STAKES}, {PROTAGONIST} embarks on a magical journey to {ROLE}. Featuring {TALENT1}'s unforgettable voice performance, this animated triumph delights audiences of all ages.",
    "{PROTAGONIST} and {TALENT1}'s voice acting bring this gorgeously animated world to life. When {STAKES}, their adventure becomes a testament to friendship and courage.",
    "Directed by {DIRECTOR}, this animated masterpiece follows {PROTAGONIST} as they discover {STAKES}. Featuring voice work by {TALENT1} and {TALENT2}, it's a visual and emotional spectacle.",
  ],
  thriller: [
    "The clock is ticking as {PROTAGONIST} races to stop {ANTAGONIST} before {STAKES}. {TALENT1}'s intense performance as {ROLE} drives this relentless thriller from start to finish.",
    "{PROTAGONIST} thought their life was normal until {STAKES}. Now they must use every skill to survive. Directed by {DIRECTOR}, featuring {TALENT1} and {TALENT2} in a white-knuckle ride.",
    "Trust no one. {PROTAGONIST} discovers that {ANTAGONIST} is far more cunning than anticipated. With {TALENT1}'s brilliant acting and {DIRECTOR}'s masterful tension-building, this is a thriller for the ages.",
  ],
  fantasy: [
    "In a realm where magic and danger collide, {PROTAGONIST} must become {ROLE} to defeat {ANTAGONIST}. Starring {TALENT1} and featuring {DIRECTOR}'s epic vision, {STAKES} hangs in the balance.",
    "{PROTAGONIST} discovers {STAKES} and must journey through enchanted lands with {TALENT1}. This fantasy epic features breathtaking visuals, compelling characters, and unforgettable moments.",
    "From sword-wielding heroes to dark sorcery, {PROTAGONIST} and {TALENT1} battle {ANTAGONIST} in this grand adventure. Director {DIRECTOR} creates a fantasy world audiences will never forget.",
  ],
  musicals: [
    "Music, dance, and heart combine as {PROTAGONIST} pursues {STAKES} with {TALENT1}'s powerhouse vocals leading the way. Director {DIRECTOR} crafts a musical triumph that will lift your spirits.",
    "{PROTAGONIST} and {TALENT1} light up the screen with stunning musical numbers while confronting {STAKES}. A joyous celebration of the human spirit featuring {TALENT2}'s show-stopping performance.",
    "When {PROTAGONIST} discovers their voice, everything changes. With {TALENT1}'s magnetic presence and {DIRECTOR}'s directorial brilliance, this musical adventure proves that {STAKES}.",
  ],
};

export function generateFilmDescription(
  genre: string,
  title: string,
  protagonist: string,
  directorName: string,
  talentNames: string[],
  antagonist: string = "the forces of darkness",
  role: string = "their true self",
  stakes: string = "everything they hold dear is on the line"
): string {
  const templates = descriptionTemplates[genre.toLowerCase()] || descriptionTemplates.drama;
  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
  
  let description = randomTemplate
    .replace("{PROTAGONIST}", protagonist || "A unlikely hero")
    .replace("{DIRECTOR}", directorName || "A visionary director")
    .replace("{ANTAGONIST}", antagonist)
    .replace("{ROLE}", role)
    .replace("{STAKES}", stakes)
    .replace("{TALENT1}", talentNames[0] || "stellar performances")
    .replace("{TALENT2}", talentNames[1] || "powerful acting");
  
  return description;
}
