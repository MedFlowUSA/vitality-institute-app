import FileUploadField from "./FileUploadField";

export default function ImageUploadField(props: {
  label: string;
  required?: boolean;
  uploading?: boolean;
  onSelect: (file: File) => void;
}) {
  return (
    <FileUploadField
      label={props.label}
      required={props.required}
      accept="image/*"
      capture="environment"
      helper="Choose a clear image."
      uploading={props.uploading}
      onSelect={props.onSelect}
    />
  );
}
