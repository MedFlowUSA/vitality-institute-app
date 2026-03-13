export default function FileUploadField({
  label,
  required,
  accept,
  capture,
  helper,
  uploading,
  onSelect,
}: {
  label: string;
  required?: boolean;
  accept?: string;
  capture?: "user" | "environment";
  helper?: string;
  uploading?: boolean;
  onSelect: (file: File) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ marginBottom: 6, color: "#F8FAFC", fontSize: 13, fontWeight: 800 }}>
        {label}
        {required ? " *" : ""}
      </div>
      <label
        className="card card-pad"
        style={{
          display: "block",
          cursor: uploading ? "not-allowed" : "pointer",
          background: "rgba(255,255,255,0.05)",
          border: "1px dashed rgba(200,182,255,0.32)",
        }}
      >
        <input
          type="file"
          accept={accept}
          capture={capture}
          disabled={uploading}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelect(file);
            e.currentTarget.value = "";
          }}
        />
        <div style={{ fontWeight: 800, color: "#F8FAFC" }}>{uploading ? "Uploading..." : "Choose File"}</div>
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
          {helper ?? "Select a file to upload."}
        </div>
      </label>
      <div className="muted" style={{ marginTop: 6, fontSize: 12, color: "rgba(226,232,240,0.8)" }}>
        {uploading ? "Uploading..." : helper ?? "Choose a file to upload."}
      </div>
    </div>
  );
}
