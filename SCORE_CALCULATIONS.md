# Score Calculation Examples

## System Overview
All scores are calculated using this formula:

```
CRITIC_SCORE = BaseScore + CriticSwing + QualityBoost + GenreBonus + 
               DirectorImpact.critic + BudgetImpact + VFXImpact + CastQuality.critic

AUDIENCE_SCORE = BaseScore + AudienceSwing + QualityBoost + AudienceGenreBonus + 
                 DirectorImpact.audience + BudgetImpact + VFXImpact + CastQuality.audience
```

Range: Critic Score (20-100), Audience Score (2.0-10.0)

---

## Example 1: ACTION FILM - "Explosive Adventure"

### Film Details:
- Genre: Action
- Script Quality: 80
- Production Budget: $80M
- Sets Budget: $25M
- Stunts Budget: $20M
- Costumes Budget: $5M
- Makeup Budget: $5M
- VFX Studio: Quality 85, specialization: [action, scifi]

### Cast:
- Lead Actor: Fame 80, skillAction 75 (strong action specialist)
- Supporting Actor: Fame 70, skillAction 68
- Supporting Actor: Fame 60, skillAction 72

### Director:
- Performance: 85, Experience: 80, Fame: 75, skillAction: 88

**Base Score:** 62 (random range 55-70) | **Critic Swing:** +4 | **Audience Swing:** -3 | **Quality Boost:** +3
**Genre Bonus:** Critic -2 / Audience +3
**Budget Impact (weights: prod 25, sets 30, stunts 25, makeup 10, costumes 10):** +2.1
**Cast Quality:** Critic +1.08 / Audience +1.87
**Director Impact:** Critic +9.8 / Audience +2.0
**VFX Impact (30% importance, matched):** +1.44

**→ CRITIC: 62 + 4 + 3 + (-2) + 9.8 + 2.1 + 1.44 + 1.08 = 81**
**→ AUDIENCE: 62 + (-3) + 3 + 3 + 2.0 + 2.1 + 1.44 + 1.87 = 7.2/10**

---

## Example 2: DRAMA FILM - "Hidden Truth"

### Film Details:
- Genre: Drama
- Script Quality: 85
- Production Budget: $40M
- Sets Budget: $8M
- Stunts Budget: $1M
- Costumes Budget: $6M
- Makeup Budget: $8M
- VFX Studio: Quality 60, specialization: [horror, scifi]

### Cast:
- Lead Actress: Fame 85, skillDrama 92
- Supporting Actor: Fame 72, skillDrama 78
- Supporting Actress: Fame 65, skillDrama 85

### Director:
- Performance: 78, Experience: 85, Fame: 80, skillDrama: 90

**Base Score:** 58 | **Critic Swing:** +6 | **Audience Swing:** -2 | **Quality Boost:** +6
**Genre Bonus:** Critic +3 / Audience -2
**Budget Impact (weights: prod 40, sets 15, stunts 5, makeup 25, costumes 15):** +1.12
**Cast Quality:** Critic +1.75 / Audience +1.97
**Director Impact:** Critic +9.46 / Audience +2.4
**VFX Impact (5% importance, not matched):** -0.01

**→ CRITIC: 58 + 6 + 6 + 3 + 9.46 + 1.12 + (-0.01) + 1.75 = 85**
**→ AUDIENCE: 58 + (-2) + 6 + (-2) + 2.4 + 1.12 + (-0.01) + 1.97 = 6.5/10**

---

## Example 3: SCIFI FILM - "Space Expedition"

### Film Details:
- Genre: SciFi
- Script Quality: 75
- Production Budget: $100M
- Sets Budget: $35M
- Stunts Budget: $12M
- Costumes Budget: $12M
- Makeup Budget: $10M
- VFX Studio: Quality 95, specialization: [scifi, animation]

### Cast:
- Lead Actor: Fame 78, skillScifi 82
- Supporting: Fame 72, skillScifi 75
- Supporting: Fame 68, skillScifi 70

### Director:
- Performance: 82, Experience: 75, Fame: 70, skillScifi: 86

**Base Score:** 64 | **Critic Swing:** +2 | **Audience Swing:** +4 | **Quality Boost:** +0
**Genre Bonus:** Critic +1 / Audience +2
**Budget Impact (weights: prod 20, sets 35, stunts 15, makeup 15, costumes 15):** +2.44
**Cast Quality:** Critic +1.28 / Audience +1.94
**Director Impact:** Critic +8.94 / Audience +1.6
**VFX Impact (30% importance, matched):** +1.68

**→ CRITIC: 64 + 2 + 0 + 1 + 8.94 + 2.44 + 1.68 + 1.28 = 82**
**→ AUDIENCE: 64 + 4 + 0 + 2 + 1.6 + 2.44 + 1.68 + 1.94 = 7.3/10**

---

## Example 4: ANIMATION FILM - "Enchanted Realm"

### Film Details:
- Genre: Animation
- Script Quality: 88
- Production Budget: $75M
- Sets Budget: $10M
- Stunts Budget: $0M
- Costumes Budget: $5M
- Makeup Budget: $35M (animation requires extensive makeup & design)
- VFX Studio: Quality 92, specialization: [animation, scifi]

### Cast (Voice actors):
- Lead Voice: Fame 88, skillAnimation 85
- Supporting: Fame 75, skillAnimation 80
- Supporting: Fame 70, skillAnimation 78

### Director:
- Performance: 88, Experience: 82, Fame: 85, skillAnimation: 92

**Base Score:** 63 | **Critic Swing:** +5 | **Audience Swing:** +2 | **Quality Boost:** +7.8
**Genre Bonus:** Critic +2 / Audience +2
**Budget Impact (weights: prod 40, sets 10, stunts 0, makeup 45, costumes 5):** +2.68
**Cast Quality:** Critic +2.10 / Audience +2.07
**Director Impact:** Critic +10 (capped) / Audience +2.8
**VFX Impact (35% importance, matched):** +2.94

**→ CRITIC: 63 + 5 + 7.8 + 2 + 10 + 2.68 + 2.94 + 2.10 = 95**
**→ AUDIENCE: 63 + 2 + 7.8 + 2 + 2.8 + 2.68 + 2.94 + 2.07 = 8.3/10**

---

## Example 5: COMEDY FILM - "Wedding Chaos"

### Film Details:
- Genre: Comedy
- Script Quality: 82
- Production Budget: $30M
- Sets Budget: $12M
- Stunts Budget: $3M
- Costumes Budget: $8M
- Makeup Budget: $5M
- VFX Studio: None (not necessary)

### Cast:
- Lead Actor: Fame 82, skillComedy 88 (comedy specialist)
- Supporting: Fame 78, skillComedy 82
- Supporting: Fame 72, skillComedy 75

### Director:
- Performance: 80, Experience: 72, Fame: 75, skillComedy: 85

**Base Score:** 60 | **Critic Swing:** -1 | **Audience Swing:** +5 | **Quality Boost:** +4.2
**Genre Bonus:** Critic -1 / Audience +3
**Budget Impact (weights: prod 35, sets 20, stunts 10, makeup 15, costumes 20):** +0.78
**Cast Quality:** Critic +1.14 / Audience +2.01
**Director Impact:** Critic +7.2 / Audience +2.0
**VFX Impact (5% importance, no studio):** +0

**→ CRITIC: 60 + (-1) + 4.2 + (-1) + 7.2 + 0.78 + 0 + 1.14 = 71**
**→ AUDIENCE: 60 + 5 + 4.2 + 3 + 2.0 + 0.78 + 0 + 2.01 = 7.8/10**

---

## Example 6: HORROR FILM - "Midnight Terror"

### Film Details:
- Genre: Horror
- Script Quality: 78
- Production Budget: $35M
- Sets Budget: $18M
- Stunts Budget: $8M
- Costumes Budget: $6M
- Makeup Budget: $8M
- VFX Studio: Quality 80, specialization: [horror, animation]

### Cast:
- Lead Actor: Fame 68, skillHorror 82
- Supporting: Fame 62, skillHorror 75
- Supporting: Fame 60, skillHorror 78

### Director:
- Performance: 75, Experience: 70, Fame: 65, skillHorror: 88

**Base Score:** 59 | **Critic Swing:** -2 | **Audience Swing:** +3 | **Quality Boost:** +1.8
**Genre Bonus:** Critic +0 / Audience +0
**Budget Impact (weights: prod 30, sets 25, stunts 15, makeup 15, costumes 15):** +1.14
**Cast Quality:** Critic +0.96 / Audience +0.97
**Director Impact:** Critic +7.5 / Audience +1.2
**VFX Impact (15% importance, matched):** +0.72

**→ CRITIC: 59 + (-2) + 1.8 + 0 + 7.5 + 1.14 + 0.72 + 0.96 = 69**
**→ AUDIENCE: 59 + 3 + 1.8 + 0 + 1.2 + 1.14 + 0.72 + 0.97 = 6.8/10**

---

## Example 7: ROMANCE FILM - "Destiny's Heart"

### Film Details:
- Genre: Romance
- Script Quality: 86
- Production Budget: $28M
- Sets Budget: $14M (locations, period pieces)
- Stunts Budget: $0M
- Costumes Budget: $12M (period/elegant clothing)
- Makeup Budget: $8M
- VFX Studio: None

### Cast:
- Lead Actress: Fame 85, skillRomance 89
- Lead Actor: Fame 82, skillRomance 86
- Supporting: Fame 70, skillRomance 78

### Director:
- Performance: 81, Experience: 78, Fame: 80, skillRomance: 87

**Base Score:** 62 | **Critic Swing:** +3 | **Audience Swing:** +4 | **Quality Boost:** +6.6
**Genre Bonus:** Critic +0 / Audience +0
**Budget Impact (weights: prod 45, sets 20, stunts 0, makeup 15, costumes 20):** +1.05
**Cast Quality:** Critic +1.81 / Audience +2.12
**Director Impact:** Critic +8.7 / Audience +2.4
**VFX Impact (5% importance, no studio):** +0

**→ CRITIC: 62 + 3 + 6.6 + 0 + 8.7 + 1.05 + 0 + 1.81 = 83**
**→ AUDIENCE: 62 + 4 + 6.6 + 0 + 2.4 + 1.05 + 0 + 2.12 = 7.8/10**

---

## Example 8: THRILLER FILM - "The Conspiracy"

### Film Details:
- Genre: Thriller
- Script Quality: 81
- Production Budget: $50M
- Sets Budget: $20M
- Stunts Budget: $15M
- Costumes Budget: $8M
- Makeup Budget: $6M
- VFX Studio: Quality 75, specialization: [action, thriller]

### Cast:
- Lead Actor: Fame 80, skillThriller 84
- Supporting: Fame 72, skillThriller 79
- Supporting: Fame 65, skillThriller 81

### Director:
- Performance: 83, Experience: 78, Fame: 72, skillThriller: 86

**Base Score:** 61 | **Critic Swing:** +2 | **Audience Swing:** +1 | **Quality Boost:** +3.6
**Genre Bonus:** Critic +0 / Audience +0
**Budget Impact (weights: prod 30, sets 25, stunts 20, makeup 10, costumes 15):** +1.98
**Cast Quality:** Critic +1.02 / Audience +1.92
**Director Impact:** Critic +9.18 / Audience +1.76
**VFX Impact (15% importance, matched):** +0.42

**→ CRITIC: 61 + 2 + 3.6 + 0 + 9.18 + 1.98 + 0.42 + 1.02 = 79**
**→ AUDIENCE: 61 + 1 + 3.6 + 0 + 1.76 + 1.98 + 0.42 + 1.92 = 7.2/10**

---

## Example 9: DOCUMENTARY FILM - "Planet Earth: Truth"

### Film Details:
- Genre: Documentary
- Script Quality: 89 (research-heavy)
- Production Budget: $18M
- Sets Budget: $3M
- Stunts Budget: $2M
- Costumes Budget: $1M
- Makeup Budget: $4M
- VFX Studio: Quality 70, specialization: [animation, scifi]

### Cast (Narrators/Hosts):
- Lead Narrator: Fame 88, skillDocumentary 91
- Supporting: Fame 78, skillDocumentary 84
- Supporting: Fame 72, skillDocumentary 80

### Director:
- Performance: 87, Experience: 89, Fame: 82, skillDocumentary: 94

**Base Score:** 65 | **Critic Swing:** +7 | **Audience Swing:** 0 | **Quality Boost:** +8.4
**Genre Bonus:** Critic +4 / Audience -2
**Budget Impact (weights: prod 50, sets 10, stunts 10, makeup 20, costumes 10):** +0.21
**Cast Quality:** Critic +2.07 / Audience +2.14
**Director Impact:** Critic +10 (capped) / Audience +2.56
**VFX Impact (5% importance, not matched):** -0.05

**→ CRITIC: 65 + 7 + 8.4 + 4 + 10 + 0.21 + (-0.05) + 2.07 = 96**
**→ AUDIENCE: 65 + 0 + 8.4 + (-2) + 2.56 + 0.21 + (-0.05) + 2.14 = 6.3/10**

---

## Key Insights by Genre:

| Genre | Critic Strength | Audience Strength | Key Budget | VFX Importance | Notes |
|-------|-----------------|-------------------|-----------|-------------------|-------|
| **Action** | Directors matter most | Audience loves action | Stunts (25%) | High (30%) | Needs action-specialized VFX |
| **Drama** | Cast quality crucial | Lower audience appeal | Production (40%) | Minimal (5%) | Critics value genre specialist actors |
| **SciFi** | High production & VFX | Moderate appeal | Sets (35%) | High (30%) | Requires both budget & specialization |
| **Animation** | Best scores overall | Family friendly | Makeup (45%) | Very High (35%) | Makeup = character design |
| **Comedy** | Lower critic scores | Highest audience appeal | Production (35%) | None (5%) | Talent/performance drives scores |
| **Horror** | Genre specialists needed | Genre fans only | Sets (25%) | Moderate (15%) | Performance matters for scares |
| **Romance** | High critic potential | High audience appeal | Production (45%) | None (5%) | Cast chemistry most important |
| **Thriller** | Director performance key | Good appeal | Stunts (20%) | Moderate (15%) | Balanced approach needed |
| **Documentary** | Highest critic potential | Lower audience appeal | Production (50%) | Minimal (5%) | Narration/expertise matters |

## Strategic Takeaways:

1. **Documentaries** = highest critic potential but lowest audience appeal (research pays off)
2. **Animation** = most forgiving genre with highest overall scores (makeup = art)
3. **Drama** = requires exceptional cast/director to compete with action films
4. **Comedy** = audience hits but critic resistance; focus on talent quality
5. **Thriller** = balanced budget allocation needed across multiple departments
6. **VFX ROI** = worth investing in action/scifi/animation, waste in drama/comedy
7. **Genre Skills** = beat raw fame in all cases; hire specialists over superstars in wrong genre
