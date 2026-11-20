# The Mathematics of BANTAY-TB's Spatial Analysis

How BANTAY-TB works out whether TB cases in Davao City are spatially clustered, and which barangays are hotspots. Each step gives the formula, explains what it means, and then works it through by hand on a small example map. The final numbers were checked against the system's own code ([`supabase/functions/_shared/spatial.ts`](../supabase/functions/_shared/spatial.ts)), and they match.

---

## 1. The question being answered

A barangay with many TB cases is not automatically a hotspot. It may simply be large, or it may be where a busy DOTS facility records its patients. BANTAY-TB answers two narrower questions:

| Question | Statistic | Output |
|---|---|---|
| Is TB clustered **anywhere** in the city, or are cases scattered randomly across barangays? | **Global Moran's I** | One number for the whole city |
| **Where** are the clusters? Which barangays are high *together with their neighbours*? | **Local Getis-Ord Gi\*** | One z-score per barangay |

Both are computed in one run, in that order. Moran's I describes the city as a whole and Gi\* locates the clusters.

---

## 2. Inputs

### 2.1 The value for each barangay, $x_i$

Davao City has $n = 182$ barangays. Each barangay $i$ gets one value $x_i$:

1. Count TB cases whose **barangay of residence** is $i$, within the analysis window (default: the last 365 days). Residence is used, not the DOTS facility, because the aim is to find where people with TB live.
2. If **every** barangay has a census population $P_i$, the value is the rate per 100,000:
$$x_i = \frac{c_i}{P_i} \times 100{,}000$$
   Otherwise the value is the raw count, $x_i = c_i$. The system never mixes rates and counts in one run. Each run records which it used (`metric = rate_per_100k` or `case_count`).
3. A barangay with no cases gets $x_i = 0$. This is a real observation, not missing data, so all 182 barangays always take part.

> **Current situation:** population figures are not loaded, so the system runs on **case counts**. The limitations this causes are described in Section 7.

### 2.2 The spatial weights, $w_{ij}$

The statistics need to know which barangays are next to each other. BANTAY-TB uses **queen contiguity**: barangays $i$ and $j$ are neighbours if their boundaries share an edge **or** a single corner, like a chess queen's moves. This is computed once from the barangay boundary polygons by [`scripts/build-barangay-neighbors.ts`](../scripts/build-barangay-neighbors.ts) and stored in the `barangay_neighbors` table.

- A barangay that touches no other barangay is given its nearest barangays by centroid instead, so every barangay has at least one neighbour.
- The relationship is symmetric: if $i$ is a neighbour of $j$, then $j$ is a neighbour of $i$.

Each statistic then converts the neighbour list into weights in its own way:

| | Moran's I | Gi\* |
|---|---|---|
| Weight scheme | **Row-standardised**: $w_{ij} = 1/k_i$ for each of $i$'s $k_i$ neighbours, so each row sums to 1 | **Binary**: $w_{ij} = 1$ for each neighbour |
| Includes the barangay itself? | No ($w_{ii} = 0$) | **Yes** ($w_{ii} = 1$). This self-inclusion is what the "\*" in Gi\* means |

---

## 3. The worked example

Five barangays, **A–E**, with these borders:

```
   A ── B
   │  ╱ │
   │ ╱  │
   C ── D ── E
```

| Barangay | Neighbours $N(i)$ | $k_i$ | Cases $x_i$ |
|---|---|---|---|
| A | B, C | 2 | 10 |
| B | A, C, D | 3 | 8 |
| C | A, B, D | 3 | 4 |
| D | B, C, E | 3 | 2 |
| E | D | 1 | 1 |

(The diagonal between B and C stands for a shared corner, which queen contiguity counts as a border.)

The basic summary values used throughout:

$$n = 5, \qquad \sum x_i = 25, \qquad \bar{x} = \frac{25}{5} = 5$$

Deviations from the mean, $z_i = x_i - \bar{x}$:

| | A | B | C | D | E | Sum |
|---|---|---|---|---|---|---|
| $z_i$ | 5 | 3 | −1 | −3 | −4 | 0 |
| $z_i^2$ | 25 | 9 | 1 | 9 | 16 | **60** |

Cases are high in the A–B corner and low in the D–E corner, so we should expect some positive clustering.

---

## 4. Global Moran's I: is there clustering?

### 4.1 The formula

$$I = \frac{n}{S_0} \cdot \frac{\sum_i \sum_j w_{ij}\, z_i\, z_j}{\sum_i z_i^2}, \qquad S_0 = \sum_i \sum_j w_{ij}$$

What it means: for each barangay, multiply its deviation $z_i$ by the weighted average deviation of its neighbours, called the **spatial lag**, $\text{lag}_i = \sum_j w_{ij} z_j$. Then add these up across all barangays.

- High next to high, or low next to low: the product is positive, so $I > 0$. This is **clustering**.
- High next to low: the product is negative, so $I < 0$. This is a **checkerboard (dispersed)** pattern.
- No relationship: $I$ is close to its expected value under randomness.

With row-standardised weights each row sums to 1, so $S_0 = n$ and the formula simplifies to

$$I = \frac{\sum_i z_i \cdot \text{lag}_i}{\sum_i z_i^2}$$

### 4.2 Step by step

**Spatial lag** for each barangay. This is the plain average of its neighbours' deviations:

| $i$ | Neighbours' $z_j$ | $\text{lag}_i$ | $z_i \cdot \text{lag}_i$ |
|---|---|---|---|
| A | B=3, C=−1 | $(3-1)/2 = 1$ | $5 \times 1 = 5$ |
| B | A=5, C=−1, D=−3 | $(5-1-3)/3 = \tfrac13$ | $3 \times \tfrac13 = 1$ |
| C | A=5, B=3, D=−3 | $(5+3-3)/3 = \tfrac53$ | $-1 \times \tfrac53 = -\tfrac53$ |
| D | B=3, C=−1, E=−4 | $(3-1-4)/3 = -\tfrac23$ | $-3 \times -\tfrac23 = 2$ |
| E | D=−3 | $-3$ | $-4 \times -3 = 12$ |
| | | **Sum** | $\mathbf{55/3 \approx 18.333}$ |

$$I = \frac{55/3}{60} = \frac{11}{36} \approx \mathbf{0.3056}$$

C is the only barangay pulling $I$ down: it is below average but borders the two highest barangays.

### 4.3 Is 0.3056 bigger than chance? The expected value

If cases were scattered at random, Moran's I would not average 0. It would average

$$E[I] = -\frac{1}{n-1} = -\frac{1}{4} = -0.25$$

For Davao City's 182 barangays, $E[I] = -1/181 \approx -0.0055$, which is very close to 0.

### 4.4 Test 1: analytical z-score (normality assumption)

The variance of $I$ under randomness depends only on the weights, through three sums:

$$S_0 = \sum_i\sum_j w_{ij}, \qquad S_1 = \tfrac12 \sum_i\sum_j (w_{ij}+w_{ji})^2, \qquad S_2 = \sum_i \Big(\sum_j w_{ij} + \sum_j w_{ji}\Big)^2$$

$$\operatorname{Var}[I] = \frac{n^2 S_1 - n S_2 + 3 S_0^2}{(n^2-1)\,S_0^2} - E[I]^2, \qquad z_I = \frac{I - E[I]}{\sqrt{\operatorname{Var}[I]}}$$

**The row-standardised weights** of the example (row $i$ = from, column $j$ = to):

| | A | B | C | D | E | Row sum | Column sum |
|---|---|---|---|---|---|---|---|
| A | · | ½ | ½ | · | · | 1 | ⅔ |
| B | ⅓ | · | ⅓ | ⅓ | · | 1 | 7/6 |
| C | ⅓ | ⅓ | · | ⅓ | · | 1 | 7/6 |
| D | · | ⅓ | ⅓ | · | ⅓ | 1 | 5/3 |
| E | · | · | · | 1 | · | 1 | ⅓ |

**$S_0$**: every row sums to 1, so $S_0 = 5$.

**$S_1$**: each neighbouring pair contributes $(w_{ij} + w_{ji})^2$:

| Pair | $w_{ij} + w_{ji}$ | Squared |
|---|---|---|
| A–B | ½ + ⅓ = 5/6 | 25/36 |
| A–C | ½ + ⅓ = 5/6 | 25/36 |
| B–C | ⅓ + ⅓ = 2/3 | 16/36 |
| B–D | ⅓ + ⅓ = 2/3 | 16/36 |
| C–D | ⅓ + ⅓ = 2/3 | 16/36 |
| D–E | ⅓ + 1 = 4/3 | 64/36 |
| | **$S_1$** | **162/36 = 4.5** |

**$S_2$**: (row sum + column sum)² for each barangay:

$$S_2 = \left(\tfrac53\right)^2 + \left(\tfrac{13}{6}\right)^2 + \left(\tfrac{13}{6}\right)^2 + \left(\tfrac83\right)^2 + \left(\tfrac43\right)^2 = \frac{100 + 169 + 169 + 256 + 64}{36} = \frac{758}{36} \approx 21.056$$

**Putting it together:**

$$\operatorname{Var}[I] = \frac{25(4.5) - 5(21.056) + 3(25)}{(25-1)(25)} - (-0.25)^2 = \frac{82.222}{600} - 0.0625 = 0.07454$$

$$z_I = \frac{0.3056 - (-0.25)}{\sqrt{0.07454}} = \frac{0.5556}{0.2730} \approx \mathbf{2.035}$$

The two-sided p-value comes from the standard normal distribution, $p = 2\,[1 - \Phi(|z|)]$:

$$p_{\text{norm}} = 2\,[1 - \Phi(2.035)] \approx \mathbf{0.042}$$

The system computes $\Phi$ with the Abramowitz & Stegun 7.1.26 approximation of the error function, whose error is below $1.5 \times 10^{-7}$.

### 4.5 Test 2: permutation test (the one to trust)

The normal approximation assumes $I$ follows a bell curve, which is questionable for skewed TB counts and small maps. A permutation test makes no such assumption:

1. Keep the map (the weights) fixed.
2. Randomly shuffle the 182 values among the barangays. This is what the map would look like if location did not matter.
3. Compute $I$ for the shuffled map.
4. Repeat $M = 999$ times.
5. Count how many shuffled maps gave $I \ge I_{\text{observed}}$. Call that count $L$, folded to the nearer tail: if more than half the shuffles were larger, use $M - L$ instead. Then

$$p_{\text{sim}} = \frac{L + 1}{M + 1}$$

The $+1$ counts the observed map as one of the possible arrangements, so $p_{\text{sim}}$ can never be exactly 0. With 999 permutations the smallest possible value is $1/1000 = 0.001$.

The shuffling uses a seeded random-number generator (mulberry32, seed 20261013), so a run can be reproduced exactly.

**In the example:** $p_{\text{sim}} = \mathbf{0.086}$.

### 4.6 What the example shows

| Test | p-value | Significant at 0.05? |
|---|---|---|
| Analytical (normal) | 0.042 | Yes |
| Permutation (999) | 0.086 | **No** |

The two tests disagree. With only 5 barangays there are just $5! = 120$ possible arrangements, and the bell-curve assumption is poor. The permutation p-value is the more honest one, which is why the system reports both and why `moran_p_sim` is the figure to cite. For 182 barangays the two usually agree more closely, but the permutation test remains the safer basis.

---

## 5. Local Getis-Ord Gi\*: where are the clusters?

### 5.1 The formula

For each barangay $i$, with **binary** weights that **include $i$ itself**:

$$G_i^* = \frac{\displaystyle\sum_j w_{ij}\,x_j \;-\; \bar{x}\,W_i}{\displaystyle S\,\sqrt{\frac{n\sum_j w_{ij}^2 - W_i^2}{n-1}}}$$

where

$$W_i = \sum_j w_{ij} = k_i + 1, \qquad S = \sqrt{\frac{\sum_j x_j^2}{n} - \bar{x}^2}$$

What it means:

- **Numerator:** the total cases in barangay $i$'s "neighbourhood" (itself plus its neighbours), minus the total you would expect if every barangay were exactly average. A positive numerator means the neighbourhood has more cases than expected.
- **Denominator:** how much a neighbourhood of that size would vary by chance.
- The result is already a **z-score**, so it is read directly against the standard normal distribution.

With binary weights $w_{ij}^2 = w_{ij}$, so $\sum_j w_{ij}^2 = W_i$ and the denominator simplifies to

$$S\,\sqrt{\frac{n W_i - W_i^2}{n-1}}$$

**Why "high together with neighbours" and not just "high":** a barangay with many cases but surrounded by low barangays gets a diluted neighbourhood sum. A barangay with **zero** cases surrounded by high ones can still score high. Both are intended. Gi\* finds *areas* of concentration, not single peaks.

### 5.2 Step by step

$$\sum x_j^2 = 100 + 64 + 16 + 4 + 1 = 185, \qquad S = \sqrt{\tfrac{185}{5} - 5^2} = \sqrt{12} \approx 3.4641$$

| $i$ | Neighbourhood (self + neighbours) | $W_i$ | $\sum_j w_{ij}x_j$ | Numerator: $\sum - 5W_i$ | Denominator: $S\sqrt{\tfrac{5W_i - W_i^2}{4}}$ | $G_i^*$ |
|---|---|---|---|---|---|---|
| A | A, B, C | 3 | 10+8+4 = 22 | 22 − 15 = **7** | $\sqrt{12}\sqrt{1.5} = 4.2426$ | **+1.650** |
| B | B, A, C, D | 4 | 8+10+4+2 = 24 | 24 − 20 = **4** | $\sqrt{12}\sqrt{1} = 3.4641$ | **+1.155** |
| C | C, A, B, D | 4 | 4+10+8+2 = 24 | 24 − 20 = **4** | 3.4641 | **+1.155** |
| D | D, B, C, E | 4 | 2+8+4+1 = 15 | 15 − 20 = **−5** | 3.4641 | **−1.443** |
| E | E, D | 2 | 1+2 = 3 | 3 − 10 = **−7** | $\sqrt{12}\sqrt{1.5} = 4.2426$ | **−1.650** |

Look at **C**. It has only 4 cases, below the mean of 5, yet its Gi\* is **positive (+1.155)**, the same as B's, because it borders the two highest barangays. This is how a low-count barangay ends up flagged as a hotspot on the real map (Section 7).

### 5.3 Classification

Each $G_i^*$ is placed in a class using the standard normal critical values:

| $G_i^*$ | Class | Confidence | Severity in BANTAY-TB |
|---|---|---|---|
| $\ge 2.58$ | `hotspot_99` | 99% | **urgent** |
| $\ge 1.96$ | `hotspot_95` | 95% | **high** |
| between −1.96 and 1.96 | `not_significant` | — | — |
| $\le -1.96$ | `coldspot_95` | 95% | — |
| $\le -2.58$ | `coldspot_99` | 99% | — |

The p-value stored with each barangay is $p_i = 2\,[1 - \Phi(|G_i^*|)]$.

**In the example**, no barangay reaches ±1.96, so all five are `not_significant`. That is the right answer for a 5-barangay map: a neighbourhood that covers most of the map can't stand out from the map's own average. With 182 barangays each neighbourhood is a small fraction of the city, so a real concentration can reach significance.

### 5.4 Edge cases the code handles

- **Every barangay has the same value:** $S = 0$, so the denominator is 0. The system returns $G_i^* = 0$ (not significant) instead of dividing by zero.
- **A barangay whose neighbourhood is the whole map** ($W_i = n$): $nW_i - W_i^2 = 0$, so it also returns 0. A neighbourhood that *is* the map cannot differ from the map. This doesn't happen in Davao City.

---

## 6. Correcting for running 182 tests at once (FDR)

Each barangay is a separate test at the 5% level. Across 182 tests, about $0.05 \times 182 \approx 9$ barangays could cross ±1.96 by chance alone. As an extra check, the system applies the **Benjamini-Hochberg** false-discovery-rate procedure:

1. Sort the $m = 182$ p-values from smallest to largest: $p_{(1)} \le p_{(2)} \le \dots \le p_{(m)}$.
2. Find the largest rank $k$ with $p_{(k)} \le \dfrac{k}{m} \times 0.05$.
3. Every barangay ranked $1$ to $k$ is flagged `fdr_significant = true`.

Example with 4 p-values `[0.001, 0.01, 0.03, 0.5]`:

| Rank $k$ | $p_{(k)}$ | Threshold $\tfrac{k}{4}(0.05)$ | Passes? |
|---|---|---|---|
| 1 | 0.001 | 0.0125 | ✓ |
| 2 | 0.01 | 0.025 | ✓ |
| 3 | 0.03 | 0.0375 | ✓ |
| 4 | 0.5 | 0.05 | ✗ |

Largest passing rank is 3, so the first three are FDR-significant.

> The FDR flag is **stored but does not change the class**. Hotspot classes and alerts still use the plain ±1.96 / ±2.58 cut-offs from Section 5.3. A barangay that is `hotspot_95` but `fdr_significant = false` should be read with more caution.

---

## 7. Applying it to Davao City: what to keep in mind

1. **Counts, not rates.** Without population figures, $x_i$ is a raw count. A barangay can rank high because it is populous, not because its residents are at higher risk. Once every barangay has a population, the system switches to rates automatically.
2. **Real cases are concentrated in a few barangays.** The real records cover only 12 of the 182 barangays, and the other 170 have $x_i = 0$. This inflates $S$ and makes Moran's I hard to reach significance. In the current real data, **Moran's I is not significant**.
3. **Gi\* still runs when Moran's I is not significant.** Moran's I does not gate Gi\*: the system always computes both. When Moran's I is not significant, Gi\* hotspots should be described as local concentrations of *recorded* cases, not as proof of citywide clustering.
4. **Zero-case hotspots are expected.** Like barangay C in the example, a barangay with no cases can be flagged because it borders a high-count barangay. On the real map, **Bago Aplaya** has no resident cases but is flagged because it borders **Talomo (Pob.)**. The Hotspots page lists the neighbouring barangays behind each such result.
5. **Validation status.** The formulas follow Getis & Ord (1992), Ord & Getis (1995) and Cliff & Ord (1981), and are designed to match PySAL `esda.Moran(..., permutations=999)` and `esda.G_Local(..., transform="B", star=True)`. They are verified against hand calculations (this document and [`src/__tests__/spatialStats.test.ts`](../src/__tests__/spatialStats.test.ts)), against a hotspot planted on the real Davao City map, and **side by side with PySAL** (`esda` 2.10.0) on the 7,305-case report dataset. Moran's I, its variance, the z-score and all 182 Gi\* z-scores are identical (largest difference $8.9 \times 10^{-16}$), giving the same 15 hotspots. See [`SPATIAL-DISTRIBUTION-CALCULATIONS.md`](SPATIAL-DISTRIBUTION-CALCULATIONS.md) §5 and [`spatial-validation/`](spatial-validation/).

---

## 8. Summary of one run

```
cases (residence, last N days)
        │
        ▼
x_i per barangay (count, or rate if all populations known)   ← all 182, zeros included
        │
        ├──► Global Moran's I  (row-standardised queen weights)
        │       I, E[I], z, p_norm, p_sim (999 permutations)
        │       → "Is TB clustered across the city?"
        │
        └──► Local Gi*  (binary queen weights + self)
                z_i per barangay → class (±1.96 / ±2.58) + FDR flag
                → "Which barangays are hotspots?"
                        │
                        ▼
           hotspot_95 / hotspot_99 → current hotspot list → alerts for NEW hotspots only
```

## 9. Answers to the worked example (checked against the system code)

| Quantity | Hand calculation | `spatial.ts` output |
|---|---|---|
| Moran's $I$ | 11/36 = 0.3056 | 0.305556 |
| $E[I]$ | −0.25 | −0.25 |
| $\operatorname{Var}[I]$ | 0.07454 | 0.074537 |
| $z_I$ | 2.035 | 2.034892 |
| $p_{\text{norm}}$ | 0.042 | 0.041862 |
| $p_{\text{sim}}$ (999 perms, default seed) | — | 0.086 |
| $G^*$ A, B, C, D, E | 1.650, 1.155, 1.155, −1.443, −1.650 | 1.6499, 1.1547, 1.1547, −1.4434, −1.6499 |
| Classes | all `not_significant` | all `not_significant` |

## References

- Cliff, A. D., & Ord, J. K. (1981). *Spatial Processes: Models and Applications*. Pion.
- Getis, A., & Ord, J. K. (1992). The analysis of spatial association by use of distance statistics. *Geographical Analysis*, 24(3), 189–206.
- Ord, J. K., & Getis, A. (1995). Local spatial autocorrelation statistics: Distributional issues and an application. *Geographical Analysis*, 27(4), 286–306.
- Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate. *Journal of the Royal Statistical Society B*, 57(1), 289–300.
- Abramowitz, M., & Stegun, I. A. (1964). *Handbook of Mathematical Functions*, formula 7.1.26.
