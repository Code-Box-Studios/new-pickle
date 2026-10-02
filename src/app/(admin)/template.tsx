export default function AdminTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-enter min-w-0">{children}</div>;
}
