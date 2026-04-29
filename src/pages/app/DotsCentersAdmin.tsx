import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import barangays from "../../data/barangays.json";
import { toast } from "sonner";

interface DotsCenter {
  id: string;
  name: string;
  address: string | null;
  barangay_psgc: number | null;
  lat: number;
  lon: number;
  phone: string | null;
  hours: string | null;
  services: string[] | null;
}

interface DotsForm {
  id: string | null;
  name: string;
  address: string;
  barangay_psgc: string;
  lat: number;
  lon: number;
  phone: string;
  hours: string;
  services: string;
}

const DAVAO_CENTER: [number, number] = [7.0731, 125.6128];
const PIN_ICON = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:#dc2626;border:3px solid white;box-shadow:0 0 0 2px #991b1b;"></div>`,
  iconSize: [14, 14],
});

const EMPTY: DotsForm = {
  id: null,
  name: "",
  address: "",
  barangay_psgc: "",
  lat: DAVAO_CENTER[0],
  lon: DAVAO_CENTER[1],
  phone: "",
  hours: "",
  services: "",
};

export function DotsCentersAdmin() {
  const [list, setList] = useState<DotsCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<DotsForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("dots_centers")
      .select("*")
      .order("name");
    if (error) toast.error(error.message);
    setList((data ?? []) as DotsCenter[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setForm({ ...EMPTY });
  }

  function openEdit(c: DotsCenter) {
    setForm({
      id: c.id,
      name: c.name,
      address: c.address ?? "",
      barangay_psgc: c.barangay_psgc != null ? String(c.barangay_psgc) : "",
      lat: c.lat,
      lon: c.lon,
      phone: c.phone ?? "",
      hours: c.hours ?? "",
      services: (c.services ?? []).join(", "),
    });
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      barangay_psgc: form.barangay_psgc
        ? Number(form.barangay_psgc)
        : null,
      lat: Number(form.lat),
      lon: Number(form.lon),
      phone: form.phone.trim() || null,
      hours: form.hours.trim() || null,
      services: form.services
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const { error } = form.id
      ? await supabase
          .from("dots_centers")
          .update(payload)
          .eq("id", form.id)
      : await supabase.from("dots_centers").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? "Center updated" : "Center added");
    setForm(null);
    load();
  }

  async function remove(c: DotsCenter) {
    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("dots_centers").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  }

  return (
    <>
      <PageHeader
        title="DOTS Centers"
        subtitle="Maintain the public DOTS Center Locator listing."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Add center
          </Button>
        }
      />

      <Card className="p-0">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">
            No DOTS centers yet. Click "Add center".
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {list.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">
                    {c.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">
                    {c.address ?? "—"}
                    {c.barangay_psgc != null && (
                      <>
                        {" · "}
                        {barangayName(c.barangay_psgc)}
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {c.lat.toFixed(4)}, {c.lon.toFixed(4)}
                    {c.phone && <> · {c.phone}</>}
                    {c.hours && <> · {c.hours}</>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(c)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900">
                {form.id ? "Edit DOTS Center" : "Add DOTS Center"}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForm(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name *">
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Davao City Health Center"
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="+63 82 ..."
                />
              </Field>
              <Field label="Address" full>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </Field>
              <Field label="Barangay">
                <Select
                  value={form.barangay_psgc}
                  onChange={(e) =>
                    setForm({ ...form, barangay_psgc: e.target.value })
                  }
                >
                  <option value="">— Select —</option>
                  {barangays.map((b) => (
                    <option key={b.psgc} value={String(b.psgc)}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Hours">
                <Input
                  value={form.hours}
                  onChange={(e) =>
                    setForm({ ...form, hours: e.target.value })
                  }
                  placeholder="Mon–Fri 8:00–17:00"
                />
              </Field>
              <Field label="Services (comma-separated)" full>
                <Textarea
                  rows={2}
                  value={form.services}
                  onChange={(e) =>
                    setForm({ ...form, services: e.target.value })
                  }
                  placeholder="DOTS, sputum AFB, IPT, contact tracing"
                />
              </Field>
              <Field label="Latitude">
                <Input
                  type="number"
                  step="0.0001"
                  value={form.lat}
                  onChange={(e) =>
                    setForm({ ...form, lat: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="0.0001"
                  value={form.lon}
                  onChange={(e) =>
                    setForm({ ...form, lon: Number(e.target.value) })
                  }
                />
              </Field>
            </div>

            <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
              <MapPicker
                lat={form.lat}
                lon={form.lon}
                onPick={(lat, lon) => setForm({ ...form, lat, lon })}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Click anywhere on the map to set the center's location.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {form.id ? "Save changes" : "Add center"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function MapPicker({
  lat,
  lon,
  onPick,
}: {
  lat: number;
  lon: number;
  onPick: (lat: number, lon: number) => void;
}) {
  const center = useMemo<[number, number]>(() => [lat, lon], [lat, lon]);
  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: 280, width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
      />
      <Marker position={[lat, lon]} icon={PIN_ICON} />
      <ClickHandler onPick={onPick} />
    </MapContainer>
  );
}

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={"block " + (full ? "sm:col-span-2" : "")}>
      <span className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function barangayName(psgc: number): string {
  return barangays.find((b) => b.psgc === psgc)?.name ?? "—";
}
