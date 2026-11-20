import json, sys, warnings
import numpy as np
warnings.filterwarnings("ignore")
import esda, libpysal
from libpysal.weights import W
from esda.moran import Moran
from esda.getisord import G_Local

nb_path, data_path, app_path = sys.argv[1:4]
nb = json.load(open(nb_path))
d = json.load(open(data_path, encoding="utf-8"))
app = json.load(open(app_path))
ids = sorted(int(k) for k in nb)
x = np.array([d[str(i)][1] for i in ids], float)
w = W({i: [int(j) for j in nb[str(i)]] for i in ids}, id_order=ids)
print("esda", esda.__version__, "libpysal", libpysal.__version__)
print("n", w.n, "pairs", w.s0 / 2, "mean_nbrs", round(w.mean_neighbors, 4), "islands", w.islands)
w.transform = "r"
np.random.seed(20261013)
m = Moran(x, w, permutations=999)
print(f"Moran I={m.I:.6f} EI={m.EI:.6f} VI_norm={m.VI_norm:.8f} z_norm={m.z_norm:.6f} p_norm={m.p_norm:.4f} p_sim={m.p_sim:.3f}")
w.transform = "b"
z = G_Local(x, w, transform="B", star=True, permutations=0).Zs
appz = np.array([app[str(i)] for i in ids])
print("Gi* max |pysal - app| =", float(np.max(np.abs(z - appz))))
hot_p = {ids[i] for i in np.where(z >= 1.96)[0]}
hot_a = {ids[i] for i in np.where(appz >= 1.96)[0]}
cls = lambda v: np.select([v >= 2.58, v >= 1.96, v <= -2.58, v <= -1.96], [2, 1, -2, -1], 0)
print("hotspots pysal", len(hot_p), "app", len(hot_a), "same set", hot_p == hot_a,
      "coldspots pysal", int((z <= -1.96).sum()),
      "class agreement", f"{(cls(z) == cls(appz)).mean() * 100:.1f}%")
