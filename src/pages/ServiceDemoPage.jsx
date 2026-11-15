import { useTranslation } from "@/lib/i18n";
import PageTitle from "@/components/common/PageTitle";
import ServiceDemoView from "@/features/service-demo/components/ServiceDemoView";

export default function ServiceDemoPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("서비스 시연")} />
      <ServiceDemoView />
    </>
  );
}
