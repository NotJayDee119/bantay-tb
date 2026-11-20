# Spatial Distribution of TB Cases: Step-by-Step Calculations

This document explains every equation behind the *Spatial Distribution of TB Cases* results (Tables 8 and 9). It uses the **same data** as the report: 7,305 TB cases across Davao City's 182 barangays (CHO 2025 + synthetic demonstration cases + system-encoded cases), counted per barangay. For each equation it gives the formula, explains what it measures, substitutes the report's actual numbers, and gives the result.

All values below were recomputed from the saved dataset ([`spatial-validation/report-dataset-2026-11-08.json`](spatial-validation/report-dataset-2026-11-08.json)) using BANTAY-TB's own code, and checked again with PySAL (Section 5). Intermediate values are shown to more decimal places than the report; the report rounds the final answers.

---

## 0. Notation and the input data

| Symbol | Meaning | Value in this analysis |
|---|---|---|
| $n$ | Number of barangays | **182** |
| $x_i$ | TB case count of barangay $i$ | 1 to 547 |
| $\sum_i x_i$ | Total cases | **7,305** |
| $\bar{x}$ | Mean cases per barangay | $7{,}305 / 182 = \mathbf{40.1374}$ |
| $z_i = x_i - \bar{x}$ | Deviation of barangay $i$ from the mean | e.g. Talomo (Pob.): $534 - 40.1374 = 493.86$ |
| $k_i$ | Number of neighbours of barangay $i$ | 2 to 13 |
| $w_{ij}$ | Spatial weight between barangays $i$ and $j$ | see Section 1 |

**Why counts and not rates.** A rate per 100,000 would be $x_i = \frac{\text{cases}_i}{\text{population}_i} \times 100{,}000$. Barangay populations were not in the dataset, so the raw count is used. Every barangay had at least one case (minimum 1), so no barangay has $x_i = 0$.

**How skewed the data is.** This matters for every result that follows:

| | Cases |
|---|---|
| Median barangay | 10 |
| Mean barangay | 40.14 |
| Largest 9 barangays (where health centres filed caseloads) | Buhangin (Pob.) 547, Talomo (Pob.) 534, Barangay 2-A 479, Bunawan (Pob.) 474, Agdao 442, Calinan (Pob.) 409, Matina Crossing 376, Daliao 312, Sasa 311 |

Those 9 barangays hold 3,884 of the 7,305 cases (53%). The mean (40) is four times the median (10).

Two summary values are reused throughout:

$$\sum_i x_i^2 = 1{,}895{,}849 \qquad \sum_i z_i^2 = \sum_i (x_i - \bar{x})^2 = 1{,}602{,}645.57$$

---

## 1. Spatial weights matrix (queen contiguity)

### 1.1 Who is a neighbour

$$c_{ij} = \begin{cases} 1 & \text{if the boundaries of barangays } i \text{ and } j \text{ touch (shared edge or corner)} \\ 0 & \text{otherwise, and always } c_{ii} = 0 \end{cases}$$

This is built from the barangay GeoJSON polygons.

**Number of neighbour pairs.** The matrix is symmetric ($c_{ij} = c_{ji}$), so every pair is counted twice when summing all entries:

$$\sum_i \sum_j c_{ij} = 1{,}000 \text{ links} \quad\Rightarrow\quad \frac{1{,}000}{2} = \mathbf{500 \text{ neighbour pairs}}$$

**Average number of neighbours:**

$$\bar{k} = \frac{1}{n}\sum_i k_i = \frac{1{,}000}{182} = \mathbf{5.49} \approx 5.5$$

Every barangay has between 2 and 13 neighbours, so none is left without a neighbour (no "islands").

### 1.2 Two versions of the weights

**Moran's I uses row-standardised weights.** Each neighbour gets an equal share, so each barangay's weights add up to 1:

$$w_{ij} = \frac{c_{ij}}{k_i} \qquad \text{e.g. Matina Aplaya has } k = 3 \text{, so each of its neighbours gets } w = \tfrac13$$

**Gi\* uses binary weights that include the barangay itself:**

$$w_{ij} = 1 \text{ if } j \text{ is a neighbour of } i \text{ or } j = i, \text{ else } 0$$

Barangay $i$'s "neighbourhood" is therefore itself plus its $k_i$ neighbours, and its total weight is $W_i = k_i + 1$.

---

## 2. Global Moran's I (Table 8)

### Equation 1: Moran's I

$$I = \frac{n}{S_0} \cdot \frac{\displaystyle\sum_i \sum_j w_{ij}\, z_i\, z_j}{\displaystyle\sum_i z_i^2}$$

**What it measures:** whether barangays with high (or low) counts sit next to other barangays with high (or low) counts.

- For each barangay, take its deviation $z_i$.
- Multiply it by the average deviation of its neighbours, called its *spatial lag*, $\text{lag}_i = \sum_j w_{ij} z_j$.
- High next to high, or low next to low, gives positive products, which push $I$ up (clustering).
- High next to low gives negative products, which push $I$ down (dispersion).

**$S_0$, the sum of all weights:** each of the 182 rows sums to 1, so

$$S_0 = \sum_i\sum_j w_{ij} = 182 \quad\Rightarrow\quad \frac{n}{S_0} = \frac{182}{182} = 1$$

**Numerator (cross-product sum):**

$$\sum_i z_i \cdot \text{lag}_i = 57{,}680.67$$

**Substituting:**

$$I = 1 \times \frac{57{,}680.67}{1{,}602{,}645.57} = 0.035991 \approx \mathbf{0.036}$$

### Equation 2: Expected I under randomness

$$E(I) = -\frac{1}{n-1} = -\frac{1}{181} = -0.005525 \approx \mathbf{-0.006}$$

**What it means:** if the 7,305 cases were scattered across barangays with no spatial pattern, Moran's I would average −0.006, not exactly 0. The observed $I = 0.036$ is only $0.036 - (-0.006) = 0.042$ above this.

### Equation 3: Weight constants $S_1$ and $S_2$

The variance of $I$ depends on the shape of the neighbour network, summarised by two constants:

$$S_1 = \frac{1}{2}\sum_i\sum_j \left(w_{ij} + w_{ji}\right)^2 = \mathbf{70.8418}$$

$S_1$ sums over every neighbour pair. Row-standardised weights are not symmetric: a barangay with 3 neighbours gives each a weight of $\tfrac13$, but a neighbour with 10 neighbours gives back only $\tfrac1{10}$. So each pair contributes $(w_{ij} + w_{ji})^2$.

$$S_2 = \sum_i \left(\sum_j w_{ij} + \sum_j w_{ji}\right)^2 = \sum_i \left(1 + \sum_j w_{ji}\right)^2 = \mathbf{751.7431}$$

$S_2$ measures how unevenly the weight flows into each barangay. The row sum is always 1. The column sum is larger for barangays that are neighbours of many small-$k$ barangays.

### Equation 4: Variance of I (normality assumption)

$$\operatorname{Var}(I) = \frac{n^2 S_1 - n S_2 + 3 S_0^2}{(n^2 - 1)\, S_0^2} - E(I)^2$$

**Substituting term by term** ($n^2 = 33{,}124$):

| Term | Calculation | Value |
|---|---|---|
| $n^2 S_1$ | $33{,}124 \times 70.8418$ | 2,346,565.21 |
| $n S_2$ | $182 \times 751.7431$ | 136,817.24 |
| $3 S_0^2$ | $3 \times 182^2$ | 99,372 |
| Numerator | $2{,}346{,}565.21 - 136{,}817.24 + 99{,}372$ | **2,309,119.97** |
| Denominator $(n^2-1) S_0^2$ | $33{,}123 \times 33{,}124$ | **1,097,166,252** |
| Fraction | $2{,}309{,}119.97 / 1{,}097{,}166{,}252$ | 0.00210462 |
| $E(I)^2$ | $(-0.005525)^2$ | 0.00003052 |

$$\operatorname{Var}(I) = 0.00210462 - 0.00003052 = \mathbf{0.00207410}, \qquad \sqrt{\operatorname{Var}(I)} = \mathbf{0.045542}$$

### Equation 5: z-score

$$z = \frac{I - E(I)}{\sqrt{\operatorname{Var}(I)}} = \frac{0.035991 - (-0.005525)}{0.045542} = \frac{0.041516}{0.045542} = 0.9116 \approx \mathbf{0.91}$$

**What it means:** the observed $I$ is 0.91 standard deviations above what randomness would give. A z-score must reach ±1.96 to be significant at 95%.

For reference, the matching analytical p-value is $p = 2[1 - \Phi(0.9116)] = 0.362$, where $\Phi$ is the standard normal cumulative distribution. The report uses the permutation p-value below instead, which is the more reliable choice for skewed counts.

### Equation 6: Permutation p-value

The normal approximation assumes $I$ follows a bell curve. That is doubtful when 9 barangays hold half the cases. The permutation test does not need that assumption:

1. Keep the map and its 500 neighbour pairs fixed.
2. Randomly reassign the 182 case counts to the 182 barangays.
3. Compute $I$ for that shuffled map.
4. Repeat $M = 999$ times.
5. Count $L$, the number of shuffled maps with $I \ge 0.036$.

$$p_{\text{sim}} = \frac{L + 1}{M + 1}$$

The report's result $p = 0.170$ means

$$\frac{L + 1}{1{,}000} = 0.170 \quad\Rightarrow\quad L = \mathbf{169}$$

So **169 of 999 random arrangements produced a Moran's I at least as high as the real one.** About 1 in 6 random maps looks this clustered, so the observed pattern is not unusual.

- The $+1$ counts the real map as one of the possible arrangements, so $p$ can never be 0. With 999 permutations the smallest possible $p$ is 0.001.
- The shuffles use a fixed seed (mulberry32, seed 20261013), so rerunning BANTAY-TB on the same data gives exactly 0.170.

### Decision (Table 8)

$$p_{\text{sim}} = 0.170 > 0.05 \quad\Rightarrow\quad \text{fail to reject spatial randomness} \quad\Rightarrow\quad \textbf{Random (not significant)}$$

**Why I is so small: the arithmetic behind the report's explanation.** Moran's I divides by $\sum z_i^2 = 1{,}602{,}645.57$. Most of that total comes from the 9 health-centre barangays. For example, Buhangin (Pob.) alone contributes $(547 - 40.14)^2 = 256{,}910$, which is 16% of the whole sum. Most of the 9 large barangays are surrounded by neighbours below the mean. For example, all 8 of Buhangin (Pob.)'s neighbours have 17–123 cases. Their large positive $z_i$ is then multiplied by a small or negative neighbour average, so they add little to the numerator while dominating the denominator. Only a few large barangays border each other (Talomo (Pob.) and Matina Crossing), and that is not enough to lift $I$.

---

## 3. Local Getis-Ord Gi\* (Table 9)

### Equation 7: Gi\* z-score

$$G_i^* = \frac{\displaystyle\sum_j w_{ij}\, x_j \;-\; \bar{x} \sum_j w_{ij}}{\displaystyle S \sqrt{\frac{n \sum_j w_{ij}^2 - \left(\sum_j w_{ij}\right)^2}{n - 1}}}$$

With binary weights, $\sum_j w_{ij} = \sum_j w_{ij}^2 = W_i$ (because $1^2 = 1$), so this simplifies to

$$G_i^* = \frac{\overbrace{\textstyle\sum_{j \in \text{nbhd}(i)} x_j}^{\text{observed neighbourhood total}} \;-\; \overbrace{\bar{x}\, W_i}^{\text{expected total}}}{S \sqrt{\dfrac{n W_i - W_i^2}{n - 1}}}$$

**What each part means:**

- **$\sum_{j \in \text{nbhd}(i)} x_j$**: total cases in barangay $i$ plus all its neighbours.
- **$\bar{x}\,W_i$**: the total you would expect if every barangay in that neighbourhood had the city average of 40.14 cases.
- **Numerator**: how many more (or fewer) cases the neighbourhood has than expected.
- **Denominator**: how much a neighbourhood of $W_i$ barangays would vary by chance. The result is a z-score.

### Equation 8: Standard deviation $S$

$$S = \sqrt{\frac{\sum_j x_j^2}{n} - \bar{x}^2} = \sqrt{\frac{1{,}895{,}849}{182} - 40.1374^2} = \sqrt{10{,}416.75 - 1{,}611.01} = \sqrt{8{,}805.74} = \mathbf{93.8389}$$

This is the population standard deviation of the 182 counts. It is the same for every barangay.

### Fully worked example: Matina Aplaya (strongest hotspot)

Matina Aplaya has 70 cases and $k = 3$ neighbours: Talomo (Pob.), Matina Crossing and Bucana.

| Step | Calculation | Result |
|---|---|---|
| Neighbourhood size | $W = k + 1 = 3 + 1$ | **4** |
| Observed neighbourhood total | Matina Aplaya 70 + Talomo (Pob.) 534 + Matina Crossing 376 + Bucana 79 | **1,059** |
| Expected neighbourhood total | $\bar{x} W = 40.1374 \times 4$ | **160.55** |
| Numerator | $1{,}059 - 160.55$ | **898.45** |
| Inside the square root | $\dfrac{182 \times 4 - 4^2}{181} = \dfrac{712}{181}$ | 3.93370 |
| Square root | $\sqrt{3.93370}$ | 1.98336 |
| Denominator | $93.8389 \times 1.98336$ | **186.116** |
| $G^*$ | $898.45 / 186.116$ | **4.83** |

Its own count is only 70, but its neighbourhood holds 1,059 cases against an expected 161. That excess is 4.83 standard deviations, the largest in the city.

### Equation 9: p-value for each barangay

$$p_i = 2\left[1 - \Phi\left(|G_i^*|\right)\right]$$

For Matina Aplaya, $p = 2[1 - \Phi(4.83)] = 0.0000014$, which the report shows as **< .001**.

### Equation 10: Classification rule

| Condition | Class | Meaning |
|---|---|---|
| $G_i^* \ge 2.58$ | Hotspot (99%) | $p \le 0.01$ |
| $1.96 \le G_i^* < 2.58$ | Hotspot (95%) | $p \le 0.05$ |
| $-1.96 < G_i^* < 1.96$ | Not significant | |
| $G_i^* \le -1.96$ | Coldspot (95%) | |
| $G_i^* \le -2.58$ | Coldspot (99%) | |

### All 15 hotspots, calculated

The denominator depends only on the neighbourhood size $W$, so barangays with the same $W$ share it.

| Barangay | Own cases | $k$ | $W$ | Observed total $\sum x_j$ | Expected $\bar{x}W$ | Numerator | Denominator | $G^*$ | $p$ | Class |
|---|---|---|---|---|---|---|---|---|---|---|
| Matina Aplaya | 70 | 3 | 4 | 1,059 | 160.55 | 898.45 | 186.116 | **4.83** | < .001 | 99% |
| Wilfredo Aquino | 29 | 5 | 6 | 1,100 | 240.82 | 859.18 | 226.660 | **3.79** | < .001 | 99% |
| Matina Crossing | 376 | 6 | 7 | 1,178 | 280.96 | 897.04 | 244.125 | **3.67** | < .001 | 99% |
| Matina Pangi | 17 | 5 | 6 | 1,040 | 240.82 | 799.18 | 226.660 | **3.53** | < .001 | 99% |
| Gov. Paciano Bangoy | 26 | 9 | 10 | 1,315 | 401.37 | 913.63 | 289.273 | **3.16** | .002 | 99% |
| Cabantian | 17 | 6 | 7 | 980 | 280.96 | 699.04 | 244.125 | **2.86** | .004 | 99% |
| Alfonso Angliongto Sr. | 24 | 6 | 7 | 966 | 280.96 | 685.04 | 244.125 | **2.81** | .005 | 99% |
| Talomo (Pob.) | 534 | 7 | 8 | 1,040 | 321.10 | 718.90 | 260.234 | **2.76** | .006 | 99% |
| Barangay 20-B (Pob.) | 35 | 4 | 5 | 760 | 200.69 | 559.31 | 207.499 | **2.70** | .007 | 99% |
| Bucana | 79 | 10 | 11 | 1,253 | 441.51 | 811.49 | 302.509 | **2.68** | .007 | 99% |
| Ma-a | 84 | 13 | 14 | 1,375 | 561.92 | 813.08 | 338.269 | **2.40** | .016 | 95% |
| Alejandra Navarro (Lasang) | 5 | 2 | 3 | 489 | 120.41 | 368.59 | 161.633 | **2.28** | .023 | 95% |
| Barangay 5-A (Pob.) | 28 | 5 | 6 | 736 | 240.82 | 495.18 | 226.660 | **2.18** | .029 | 95% |
| Bago Aplaya | 8 | 3 | 4 | 562 | 160.55 | 401.45 | 186.116 | **2.16** | .031 | 95% |
| Tigatto | 39 | 7 | 8 | 864 | 321.10 | 542.90 | 260.234 | **2.09** | .037 | 95% |

### What drives each hotspot

Almost every hotspot borders at least one of the large health-centre barangays. The table shows the neighbours each hotspot's total comes from:

| Hotspot | Largest neighbours (cases) |
|---|---|
| Matina Aplaya | Talomo (Pob.) 534, Matina Crossing 376, Bucana 79 |
| Wilfredo Aquino | Buhangin (Pob.) 547, Agdao 442 |
| Matina Crossing | Talomo (Pob.) 534, Ma-a 84, Bucana 79, Matina Aplaya 70 |
| Matina Pangi | Talomo (Pob.) 534, Matina Crossing 376, Ma-a 84 |
| Gov. Paciano Bangoy | Buhangin (Pob.) 547, Agdao 442, Barangay 19-B 123 |
| Cabantian | Buhangin (Pob.) 547, Sasa 311 |
| Alfonso Angliongto Sr. | Buhangin (Pob.) 547, Sasa 311 |
| Talomo (Pob.) | Matina Crossing 376, Matina Aplaya 70 |
| Barangay 20-B (Pob.) | Buhangin (Pob.) 547, Barangay 19-B 123 |
| Bucana | Barangay 2-A 479, Matina Crossing 376, Ma-a 84, Matina Aplaya 70 |
| Ma-a | Barangay 2-A 479, Matina Crossing 376, Barangay 19-B 123, Bucana 79 |
| Alejandra Navarro (Lasang) | Bunawan (Pob.) 474 |
| Barangay 5-A (Pob.) | Barangay 2-A 479, Ma-a 84, Bucana 79 |
| Bago Aplaya | Talomo (Pob.) 534 |
| Tigatto | Buhangin (Pob.) 547, Barangay 19-B 123, Ma-a 84 |

**Why Matina Aplaya outranks Talomo (Pob.) even though Talomo has 534 cases.** Talomo (Pob.) has 7 neighbours, mostly small ones (Catalunan Pequeño 13, Bago Gallera 11, Catalunan Grande 11, Bago Aplaya 8 and others). They dilute its neighbourhood: total 1,040 over $W = 8$, so $z = 2.76$. Matina Aplaya has only 3 neighbours, and two of them are the two largest in the area, so its neighbourhood of 4 holds 1,059 cases, giving $z = 4.83$.

**Why Buhangin (Pob.), with the most cases (547), is not a hotspot.** It has 8 neighbours, and all of them are small: the largest is Barangay 19-B with 123, and the rest have 17–39. Its neighbourhood of $W = 9$ holds 869 cases. A $W = 9$ neighbourhood needs 900.7 to reach $z = 1.96$, so Buhangin (Pob.) gets $G^* = 1.84$, just short. The same happens to the other health-centre barangays: Barangay 2-A ($z = 1.68$), Bunawan (Pob.) ($1.61$) and Agdao ($1.47$). Gi\* flags the small barangays **next to** a large count, not the large count when it sits among small ones.

### How many cases a neighbourhood needs to become a hotspot

Rearranging Equation 7 for $G_i^* = 1.96$ gives the smallest neighbourhood total that produces a hotspot:

$$\sum_{j \in \text{nbhd}(i)} x_j \;\ge\; \bar{x}\, W_i + 1.96 \cdot S\sqrt{\frac{n W_i - W_i^2}{n-1}}$$

| $W$ (self + neighbours) | Denominator | Needed for 95% hotspot | Needed for 99% hotspot |
|---|---|---|---|
| 3 | 161.633 | 437.2 | 537.4 |
| 4 | 186.116 | 525.3 | 640.7 |
| 5 | 207.499 | 607.4 | 736.0 |
| 6 | 226.660 | 685.1 | 825.6 |
| 7 | 244.125 | 759.4 | 910.8 |
| 8 | 260.234 | 831.2 | 992.5 |
| 10 | 289.273 | 968.3 | 1,147.7 |
| 11 | 302.509 | 1,034.4 | 1,222.0 |
| 14 | 338.269 | 1,224.9 | 1,434.7 |

Example: Tigatto ($W = 8$) has a neighbourhood total of 864, just above the 831.2 needed, so it is a 95% hotspot with $z = 2.09$. In general, a neighbourhood containing **one** of the 300–550-case health-centre barangays almost reaches the threshold by itself when $W$ is small.

### Why there are no coldspots: a mathematical bound

A coldspot needs $G_i^* \le -1.96$. The lowest possible neighbourhood total is 0, which would mean every barangay in the neighbourhood had zero cases. Even then:

$$G_i^*{}_{\min} = \frac{0 - \bar{x}\, W_i}{S\sqrt{\dfrac{nW_i - W_i^2}{n-1}}}$$

| $W$ | 3 | 4 | 6 | 8 | 11 | 14 (largest in Davao City) |
|---|---|---|---|---|---|---|
| Lowest possible $G^*$ | −0.745 | −0.863 | −1.062 | −1.234 | −1.459 | **−1.661** |

The most negative value any barangay could reach is **−1.661**, even with zero cases in its whole neighbourhood. That never reaches −1.96, so **a coldspot is mathematically impossible with this data**. The lowest observed value was −1.46.

The reason is the one the report gives: the health-centre barangays raise the mean ($\bar{x} = 40.1$) and greatly raise the spread ($S = 93.8$). Being below average by at most 40 cases per barangay is small relative to a standard deviation of 94.

---

## 4. Benjamini-Hochberg false-discovery-rate correction

### Why it is needed

182 barangays are each tested at $\alpha = 0.05$. Even with no real clustering, about $182 \times 0.05 \approx 9$ barangays could pass ±1.96 by chance. The FDR correction controls the expected share of false hotspots among those flagged.

### Equation 11: BH threshold

Sort all 182 p-values from smallest to largest, $p_{(1)} \le p_{(2)} \le \dots \le p_{(182)}$, and compare each with its own threshold:

$$p_{(k)} \;\le\; \frac{k}{m}\, q = \frac{k}{182} \times 0.05 = k \times 0.00027473$$

The largest rank $k$ that passes is found, and **every barangay ranked 1 to $k$** is declared significant.

| Rank $k$ | Barangay | $G^*$ | $p_{(k)}$ | Threshold $k \times 0.00027473$ | Passes? |
|---|---|---|---|---|---|
| 1 | Matina Aplaya | 4.83 | 0.0000014 | 0.000275 | ✓ |
| 2 | Wilfredo Aquino | 3.79 | 0.000150 | 0.000549 | ✓ |
| 3 | Matina Crossing | 3.67 | 0.000238 | 0.000824 | ✓ |
| 4 | Matina Pangi | 3.53 | 0.000422 | 0.001099 | ✓ |
| 5 | Gov. Paciano Bangoy | 3.16 | 0.001587 | 0.001374 | ✗ |
| 6 | Cabantian | 2.86 | 0.004191 | 0.001648 | ✗ |
| 7 | Alfonso Angliongto Sr. | 2.81 | 0.005015 | 0.001923 | ✗ |
| … | … | … | … | … | ✗ |
| 15 | Tigatto | 2.09 | 0.036960 | 0.004121 | ✗ |

The largest passing rank is $k = 4$, and no later rank passes. So **4 hotspots survive the FDR correction**: Matina Aplaya, Wilfredo Aquino, Matina Crossing and Matina Pangi.

Gov. Paciano Bangoy just misses: its $p = 0.001587$ is above its threshold of $0.001374$.

The other 11 hotspots are significant at the individual 95% level but not after correcting for 182 simultaneous tests. They should be described as less certain.

---

## 5. Software validation

The same dataset and the same queen weights were analysed in **PySAL** (`esda` 2.10.0, `libpysal` 4.15.1) using the equivalent functions:

- `esda.Moran(x, w, permutations=999)` with row-standardised weights
- `esda.G_Local(x, w, transform="B", star=True)`

| Quantity | BANTAY-TB | PySAL | Difference |
|---|---|---|---|
| Neighbour pairs / mean neighbours | 500 / 5.49 | 500 / 5.49 | none |
| Moran's I | 0.035991 | 0.035991 | none |
| $E(I)$ | −0.005525 | −0.005525 | none |
| $\operatorname{Var}(I)$ | 0.00207410 | 0.00207410 | none |
| z-score | 0.911588 | 0.911588 | none |
| Permutation p-value | 0.170 | 0.166 | see note |
| Gi\* z-scores (all 182) | | | largest difference $8.9 \times 10^{-16}$ |
| Hotspots | 15 | 15 | same 15 barangays |
| Coldspots | 0 | 0 | none |
| Class agreement (all 182 barangays) | | | 100% |

**About the 0.170 vs 0.166.** A permutation p-value depends on which 999 random shuffles are drawn. BANTAY-TB and PySAL use different random-number generators, so they draw different shuffles. The expected random variation is

$$\text{SE} = \sqrt{\frac{p(1-p)}{M}} = \sqrt{\frac{0.17 \times 0.83}{999}} = 0.012$$

The 0.004 difference is well inside that, and both give the same conclusion (not significant). Every deterministic quantity ($I$, $E(I)$, variance, z, all Gi\* scores) is identical. A difference of $10^{-16}$ is ordinary floating-point rounding.

To reproduce, see [`spatial-validation/`](spatial-validation/): `app_gi_z.ts` runs BANTAY-TB's code, and `pysal_check.py` runs PySAL and compares the two.

---

## 6. Summary of the results

| Step | Equation | Result |
|---|---|---|
| Mean, SD of counts | $\bar{x} = \tfrac{\sum x}{n}$, $S = \sqrt{\tfrac{\sum x^2}{n} - \bar{x}^2}$ | 40.14, 93.84 |
| Neighbour structure | queen contiguity | 500 pairs, mean 5.49 neighbours |
| Moran's I | Eq. 1 | 0.036 |
| Expected I | Eq. 2 | −0.006 |
| Variance of I | Eq. 3–4 | 0.002074 |
| z-score | Eq. 5 | 0.91 |
| Permutation p | Eq. 6 | 0.170 (169 of 999 random maps as clustered): **not significant** |
| Gi\* hotspots | Eq. 7–10 | 15 (10 at 99%, 5 at 95%) |
| Coldspots | Eq. 7 bound | 0; the lowest possible $G^*$ is −1.66 |
| FDR-significant hotspots | Eq. 11 | 4 |
| PySAL agreement | | identical I, z and Gi\*; same 15 hotspots |

## References

- Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate: a practical and powerful approach to multiple testing. *Journal of the Royal Statistical Society: Series B*, 57(1), 289–300.
- Cliff, A. D., & Ord, J. K. (1981). *Spatial Processes: Models and Applications*. London: Pion.
- Getis, A., & Ord, J. K. (1992). The analysis of spatial association by use of distance statistics. *Geographical Analysis*, 24(3), 189–206.
- Ord, J. K., & Getis, A. (1995). Local spatial autocorrelation statistics: distributional issues and an application. *Geographical Analysis*, 27(4), 286–306.
- Rey, S. J., & Anselin, L. (2007). PySAL: A Python library of spatial analytical methods. *The Review of Regional Studies*, 37(1), 5–27.
