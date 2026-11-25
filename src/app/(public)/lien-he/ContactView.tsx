// Trang Liên hệ: dựng từ dữ liệu `site.info` của admin (lib/v3-contact.ts). Thành phần máy chủ, không cần JS: số điện thoại là
// liên kết gọi, bản đồ là iframe nạp lười, nút chỉ đường là liên kết thường. Ô nào admin chưa nhập thì không hiện.
import type { ComponentType } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, Phone } from "lucide-react";
import { FaFacebook, FaGlobe, FaInstagram, FaTiktok, FaUsers, FaYoutube } from "react-icons/fa6";
import PlainHero from "@/components/public/PlainHero";
import { contactGroups, formatPhone } from "@/lib/contact-format";
import type { ContactPageData } from "@/lib/v3-contact";
import type { SocialNetwork } from "@/lib/v3-menu";

const AVO = { fontFamily: "'UTM Avo', sans-serif" } as const;
const NIAGARA = { fontFamily: "'UTM Niagara', serif" } as const;

const CARD = "rounded-2xl border border-[#F2C14E]/30 bg-gradient-to-b from-[#25170E] to-[#1C130D] p-5 shadow-xl flex flex-col gap-2";
const LINK = "inline-flex items-center min-h-12 text-sm font-bold text-[#F2C14E] hover:text-white underline-offset-4 hover:underline";

const ZaloMark: ComponentType<{ className?: string }> = ({ className }) => (
  <span aria-hidden="true" className={`${className ?? ""} flex items-center justify-center font-bold leading-none`}>Z</span>
);
const SOCIAL_ICON: Record<SocialNetwork, ComponentType<{ className?: string }>> = {
  facebook: FaFacebook,
  "facebook-group": FaUsers,
  youtube: FaYoutube,
  tiktok: FaTiktok,
  instagram: FaInstagram,
  zalo: ZaloMark,
  website: FaGlobe,
};

function Card({ icon: Icon, title, children }: { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; title: string; children: React.ReactNode }) {
  return (
    <li className={CARD}>
      <div className="w-11 h-11 rounded-full border border-[#F2C14E]/50 bg-[#2C1C11] flex items-center justify-center text-[#F2C14E]">
        <Icon className="w-5 h-5" aria-hidden={true} />
      </div>
      <h3 className="text-2xl font-normal text-[#F2C14E] uppercase tracking-wide" style={NIAGARA}>
        {title}
      </h3>
      <div className="text-sm text-[#e3d2c1] leading-relaxed flex flex-col gap-1" style={AVO}>
        {children}
      </div>
    </li>
  );
}

export default function ContactView({ data }: { data: ContactPageData }) {
  const main = data.phones[0];
  const groups = contactGroups(data.phones);
  return (
    <div className="min-h-screen bg-[#2A1D14] text-[#e3d2c1] selection:bg-[#F2C14E] selection:text-black">
      <main className="pb-12 md:pb-16">
        <PlainHero title="Liên hệ">{data.slogan}</PlainHero>

        <div className="max-w-[1280px] mx-auto px-4 md:px-10 mt-8 flex flex-col gap-10">
          {!data.known ? (
            <p className="rounded-2xl border border-[#F2C14E]/30 bg-[#25170E] p-5 text-sm text-[#e3d2c1]" style={AVO} role="status">
              Thông tin liên hệ đang được cập nhật. Kính mời quý vị xem lịch khóa tu, cộng tu và đại lễ ở mục Lịch tu học.
            </p>
          ) : null}

          <section aria-labelledby="thong-tin-lien-he">
            <h2 id="thong-tin-lien-he" className="sr-only">
              Thông tin liên hệ
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 list-none p-0 m-0">
              {data.address ? (
                <Card icon={MapPin} title="Địa chỉ">
                  <p>{data.address}</p>
                  {data.mapsUrl ? (
                    <a className={LINK} href={data.mapsUrl} target="_blank" rel="noopener noreferrer">
                      Chỉ đường<span className="sr-only"> (mở Google Maps trong thẻ mới)</span>
                    </a>
                  ) : null}
                </Card>
              ) : null}
              {main ? (
                <Card icon={Phone} title="Gọi điện">
                  <p>{`${main.role}: ${main.name}`}</p>
                  <a className={LINK} href={`tel:${main.phone}`}>
                    {formatPhone(main.phone)}
                  </a>
                </Card>
              ) : null}
              {data.openingHours ? (
                <Card icon={Clock} title="Giờ mở cửa">
                  <p>{data.openingHours}</p>
                </Card>
              ) : null}
              <Card icon={CalendarDays} title="Khóa tu, cộng tu">
                <p>Lịch khóa tu, cộng tu và đại lễ trong năm.</p>
                <Link className={LINK} href="/lich-tu-hoc">
                  Xem lịch tu học
                </Link>
              </Card>
            </ul>
          </section>

          {groups.length > 0 || data.mapEmbedUrl ? (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8" aria-label="Danh bạ và bản đồ">
              {groups.length > 0 ? (
                <div className={`${CARD} gap-4`}>
                  <h2 className="text-3xl font-normal text-[#F2C14E] uppercase tracking-wide" style={NIAGARA}>
                    Danh bạ
                  </h2>
                  {groups.map(({ role, people }) => (
                    <div key={role} className="flex flex-col gap-1">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#E2C89B]" style={AVO}>
                        {role}
                      </h3>
                      <ul className="list-none p-0 m-0 flex flex-col">
                        {people.map(({ name, phone }) => (
                          <li key={`${name}-${phone}`} className="border-b border-[#F2C14E]/15 last:border-b-0">
                            <a href={`tel:${phone}`} className="flex items-center justify-between gap-3 min-h-12 py-2 text-sm hover:text-white" style={AVO}>
                              <span>{name}</span>
                              <span className="font-bold text-[#F2C14E] whitespace-nowrap">{formatPhone(phone)}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}

              {data.mapEmbedUrl ? (
                <div className={`${CARD} gap-0 p-0 overflow-hidden ${groups.length === 0 ? "lg:col-span-2" : ""}`}>
                  <iframe
                    src={data.mapEmbedUrl}
                    title={data.title ? `Bản đồ đường đến ${data.title}` : "Bản đồ đường đến chùa"}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    className="w-full h-[360px] border-0 bg-[#1A120B]"
                  />
                  <div className="p-5 flex flex-col gap-2" style={AVO}>
                    {data.title ? <p className="text-xl text-[#F2C14E]" style={NIAGARA}>{data.title}</p> : null}
                    {data.address ? <p className="text-sm">{data.address}</p> : null}
                    {data.mapsUrl ? (
                      <a
                        className="self-start inline-flex items-center min-h-12 px-6 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#D4A017] to-[#F2C14E] text-[#1A120B] hover:scale-105 transition-transform"
                        href={data.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Mở Google Maps<span className="sr-only"> (mở trong thẻ mới)</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {data.social.length > 0 ? (
            <section aria-labelledby="mang-xa-hoi">
              <h2 id="mang-xa-hoi" className="text-3xl font-normal text-[#F2C14E] uppercase tracking-wide mb-4" style={NIAGARA}>
                Trang chính thức
              </h2>
              <ul className="flex flex-wrap gap-3 list-none p-0 m-0">
                {data.social.map(({ label, url, network }) => {
                  const Icon = SOCIAL_ICON[network];
                  return (
                    <li key={`${label}-${url}`}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 min-h-12 px-5 rounded-full border border-[#F2C14E]/40 bg-[#25170E] text-sm font-bold text-[#e3d2c1] hover:border-[#F2C14E] hover:text-[#F2C14E] transition-colors"
                        style={AVO}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                        <span className="sr-only"> (mở trong thẻ mới)</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
