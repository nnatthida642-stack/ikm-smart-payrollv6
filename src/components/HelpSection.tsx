import React, { useState } from 'react';
import { HelpCircle, Clock, BookOpen, Calculator, Calendar, Smartphone, Mail, Phone, ExternalLink, ShieldAlert, BadgeInfo, PlayCircle, Layers, CheckCircle } from 'lucide-react';

interface HelpSectionProps {
  isDark: boolean;
}

export default function HelpSection({ isDark }: HelpSectionProps) {
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);

  const bgCard = isDark ? 'bg-[#141414] border-white/10' : 'bg-white border-slate-200 shadow-sm';
  const textTitle = isDark ? 'text-white' : 'text-slate-850';
  const textSub = isDark ? 'text-gray-400' : 'text-slate-500';

  const faqs = [
    {
      q: "หลักเกณฑ์การคำนวณวันเสาร์ เป็นอย่างไร?",
      a: "ระบบแชร์หลักเกณฑ์ออกเป็น 2 กลุ่มหลักตามกฎของบริษัท:\n1) กลุ่มพนักงานรายวัน (Daily Worker): วันเสาร์จะเป็นวันทำงานเต็มวันปกติ (8 ชั่วโมง) ไม่มีการคิดกะพิเศษครึ่งวัน โดยคิดชั่วโมงปกติสูงสุด 8 ชั่วโมง หากทำงานเกิน 8 ชั่วโมงไปจะเริ่มคิดค่าล่วงเวลา (OT 1.5) ทันที\n2) กลุ่มพนักงานอื่นๆ (Technician, Officer, Manager, Developer, Staff): ทำงานปกติวันจันทร์ - ศุกร์ ส่วนวันเสาร์จะทำครึ่งวัน (4 ชั่วโมง เวลา 08:00 - 12:00 น.) ชั่วโมงปฏิบัติงานปกติจะสูงสุด 4 ชั่วโมง โดยเมื่อทำงานหลัง 12:00 น. เป็นต้นไป (เกิน 4 ชั่วโมงปกติ) ระบบจะคิดเป็นชั่วโมงโอทีล่วงเวลาคูณ 1.5 เท่าตามกฎหมาย"
    },
    {
      q: "การคำนวณแบบเหมาจ่าย 'Flat Rate' 12 ชั่วโมงสอดคล้องอะไรบ้าง?",
      a: "พนักงานประเภทรับเหมา Flat Rate (เช่น งานเฝ้าไซส์ งานเดินทางพิเศษ) จะคิดค่าจ้างในตัวเป็นอัตราสัญญารูปแบบเดียวสำหรับการทำงาน 12 ชั่วโมง/กะ โดยไม่ว่าวันนั้นจะเป็นวันธรรมดา วันเสาร์ วันอาทิตย์ หรือวันหยุดนักขัตฤกษ์ ระบบจะลงชั่วโมงปกติให้สูงสุด 12 ชั่วโมงโดยไม่มีค่าโอที (No OT Rate) ตามระบบนโยบาย Offshore หรือ Flat Rate ทั่วไป"
    },
    {
      q: "กฎเข้ากะในเวลาเที่ยงคืน มีเงื่อนไขอย่างไร?",
      a: "กรณีพนักงานเข้ากะรอบพิเศษช่วงพักเที่ยงคืน (00:00 เป็นต้นไป) ระบบจะบันทึกชั่วโมงทำงานตรงช่วงเวลาปกติ 8 ชั่วโมงแรกตามปกติโดยที่ยังไม่มี OT จนกระทั่งเมื่อถึงเวลาหลังตี 5 (05:00 น.) หากระยะเวลาทำงานรวมสะสมของรอบปฏิบัติงานนั้นเกิน 8 ชั่วโมงไปแล้ว ชั่วโมงสว่นเกินนั้นจะถูกคิดคูณอัตราล่วงเวลา (Overtime) ตามกฎหมายปกติทันที (เว้นแต่เป็นพนักงาน Flat Rate)"
    },
    {
      q: "ต้องการเปลี่ยนหรือกำหนดอัตราค่าจ้างพนักงานแต่ละคน ต้องทำอย่างไร?",
      a: "คุณสามารถสลับไปยังแท็บ 'ข้อมูลประวัติพนักงาน' เพื่อทำการเพิ่ม ลบ หรือแก้ไขข้อมูลช่างรายบุคคล เช่น เงินเดือนประจำสำหรับพนักงานออฟฟิศ อัตราคาจ้างรายวันกรณีออกช็อป (Workshop) ออกไซส์นอกสถานที่ (Onsite) ทำงานกลางทะเล (Offshore) หรือทำงานที่บ้าน (WFH) รวมถึงธนาคารเลขบัญชี และยอดหักเงินกู้ กยศ."
    }
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fade-in font-sans">
      {/* Welcome Banner */}
      <div className={`p-6 rounded-sm border ${bgCard} flex flex-col md:flex-row items-center gap-6`}>
        <div className="p-4 bg-[#D4AF37]/10 rounded-sm text-[#D4AF37] shrink-0">
          <BookOpen className="w-10 h-10 animate-pulse" />
        </div>
        <div className="space-y-1.5 text-center md:text-left">
          <h2 className="text-lg font-serif uppercase tracking-wider text-[#D4AF37]">
            ศูนย์บริการช่วยเหลือและแนะนำการใช้งานระบบ (Thai Timesheet User Guide & Manual)
          </h2>
          <p className="text-xs text-gray-400">
            คำอธิบายฟังก์ชัน วิธีนำเข้าตารางเวลาจากรอกประมวล Excel, ตัวอย่างการคิดสูตรโอที และช่องทางติดต่อฝ่ายวิศวกรดูแลระบบ
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core Manual Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Quick-start manual walkthrough */}
          <div className={`p-6 rounded-sm border ${bgCard} space-y-4`}>
            <h3 className={`text-sm font-bold uppercase tracking-wider ${textTitle} flex items-center gap-2 border-b border-white/10 pb-3`}>
              <PlayCircle className="w-5 h-5 text-[#D4AF37]" />
              ขั้นตอนการใช้งานโปรแกรมสำหรับฝ่ายบัญชี (Standard Operating Procedures)
            </h3>
            
            <div className="space-y-4 text-xs leading-relaxed text-gray-400">
              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                <div>
                  <strong className="text-white">เพิ่มทะเบียนประวัติพนักงาน</strong>
                  <p className="mt-0.5">เข้าไปลงบันทึกข้อมูลพนักงานรายเดือนและพนักงานรายวันของโครงการคุณที่แท็บ <strong className="text-gray-300">ข้อมูลประวัติพนักงาน</strong> ระบบใช้รายละเอียดเหล่านี้ดึงไปคำนวณฐานสลิปเงินเดือนแบบวินาทีต่อวินาที</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                <div>
                  <strong className="text-white">นำเข้าข้อมูลเวลาผ่านตารางหรือ Excel</strong>
                  <p className="mt-0.5">ในหน้า <strong className="text-gray-300">สมุดบันทึก Timesheet</strong> คุณสามารถกรอกทีละบรรทัด หรือคลิกปุ่มสีส้มนำเข้าแบบด่วน โดยสามารถคัดลอกเซลล์หลายแถวจาก Google Sheet แล้วจับมาวาง (Paste) ลงในแบบฟอร์มเพื่อบันทึกครั้งละเป็นร้อยๆ เรคคอร์ดได้เลยทันที!</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
                <div>
                  <strong className="text-white">ตรวจสอบชั่วโมงล่วงเวลาและออกเอกสารบัญชี</strong>
                  <p className="mt-0.5">ไปที่หน้า <strong className="text-gray-300">รายงานเวลาพนักงานเดี่ยว</strong> เพื่อตรวจสอบชั่วโมงสะสมรวมรายบุคคล หรือไปยังแท็บ <strong className="text-gray-300">คำนวณเบิกจ่าย & ออกสลิป</strong> เพื่อสรุปยอดรายรับสุทธิ (Net Payment) หักล้างกองทุนประกันสังคม (SSO) ภาษี ณ ที่จ่าย และหนี้ กยศ. พร้อมพิมพ์สลิปและซิงค์สรุปขึ้นคลาวด์ได้ด้วยปุ่มเดียว</p>
                </div>
              </div>
            </div>
          </div>

          {/* Formula Examples Module */}
          <div className={`p-6 rounded-sm border ${bgCard} space-y-4`}>
            <h3 className={`text-sm font-bold uppercase tracking-wider ${textTitle} flex items-center gap-2 border-b border-white/10 pb-3`}>
              <Calculator className="w-5 h-5 text-sky-450" />
              ตัวอย่างจำลองสมการระบบ (Worked Overtime Examples)
            </h3>
            
            <div className={`p-4 rounded-[3px] ${isDark ? 'bg-black/40' : 'bg-slate-50'} border border-white/5 space-y-3.5 text-xs`}>
              <div>
                <span className="inline-block px-2 py-0.5 rounded-sm bg-sky-505/15 text-sky-400 font-mono text-[9px] font-bold mb-1">ตัวอย่างที่ 1 (กรณีกะวันอังคาร/วันทำงานปกติ - Wednesday Shift)</span>
                <p className={`${textTitle} font-bold`}>เวลาเข้า-ออก: In 08:00 | Out 19:00 | คำสั่งทำโอทีช่วงพักเที่ยง: คีย์ 1 (บันทึกว่าทำ)</p>
                <div className="text-gray-400 space-y-1 mt-1 font-mono text-[11px]">
                  <div>• เวลาที่อยู่สแตนด์บายรวม = 11.0 ชั่วโมง (19:00 - 08:00)</div>
                  <div>• หักล้างเวลาพักผ่อนสากล 1 ชั่วโมงคงเหลือเวลาทำงานจริง = 10.0 ชั่วโมง</div>
                  <div>• ได้เวลาปกติ (Standard Peak Limit) = <strong className="text-[#D4AF37]">8.0 ชั่วโมง</strong></div>
                  <div>• ได้ชั่วโมงหลังเลิกงานปกติ = 2.0 ชั่วโมง</div>
                  <div>• บวกโอทีพักเที่ยง (Lunch Hour Active) = 1.0 ชั่วโมง</div>
                  <div className="text-emerald-400 font-bold">• ยอดที่คำนวณได้สุดท้าย: ชั่วโมงปกติ = 8.0 ชม. | OT 1.5 = 3.0 ชม. (2 + 1) | OT 2.0/3.0 = 0 ชม.</div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3">
                <span className="inline-block px-2 py-0.5 rounded-sm bg-amber-505/15 text-amber-500 font-mono text-[9px] font-bold mb-1">ตัวอย่างที่ 2 (กะพิเศษวันเสาร์ 8.00 - 17.00 น.)</span>
                <p className={`${textTitle} font-bold`}>เวลาเข้า-ออก: In 08:00 | Out 17:00 | หักพักปกติ 1 ชั่วโมง</p>
                <div className="text-gray-400 space-y-1 mt-1 font-mono text-[11px]">
                  <div>• ชั่วโมงทำงานจริงสุทธิ = 8.0 ชั่วโมง (9.0 - 1.0)</div>
                  <div>• เกณฑ์วันเสาร์ชั่วโมงปกติสูงสุด = <strong className="text-sky-305">4.0 ชั่วโมง</strong> (08.00 - 12.00)</div>
                  <div>• เศษชั่วโมงที่เหลือหลัง 12.00 น. = 4.5 ชั่วโมง (แต่หักล้างเวลาพัก 1.0 ชั่วโมงในกะ เหลือ 3.0)</div>
                  <div className="text-emerald-400 font-bold">• ยอดคำนวณได้สุดท้าย: ชั่วโมงปกติ = 4.0 ชม. | OT 1.5 = 4.0 ชม. (หรือขึ้นอยู่กับระยะช็อปโอทีพักเที่ยง)</div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Accordion list */}
          <div className="space-y-3">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${labelText(isDark)}`}>คำถามที่พบบ่อย (Frequently Asked Questions)</h4>
            <div className="space-y-2">
              {faqs.map((faq, idx) => (
                <div key={idx} className={`p-4 rounded-sm border ${bgCard} transition-all`}>
                  <button
                    onClick={() => setActiveQuestion(activeQuestion === idx ? null : idx)}
                    className="w-full text-left font-bold text-xs flex items-center justify-between text-gray-200 focus:outline-hidden cursor-pointer"
                  >
                    <span className={activeQuestion === idx ? 'text-[#D4AF37]' : ''}>{faq.q}</span>
                    <span className="text-[10px] text-gray-500 font-mono">{activeQuestion === idx ? '▲ ปิด' : '▼ ขยาย'}</span>
                  </button>
                  {activeQuestion === idx && (
                    <p className="text-xs text-gray-400 mt-2.5 pt-2.5 border-t border-white/5 leading-relaxed">
                      {faq.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Contacts & Contacts */}
        <div className="space-y-6">
          <div className={`p-5 rounded-sm border ${bgCard} space-y-4`}>
            <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
              <Phone className="w-4 h-4 text-[#D4AF37]" />
              ช่องทางสนับสนุน (Administration Support)
            </div>
            <p className="text-[11px] text-gray-400 leading-normal">
              กรณีพบปัญหาเกี่ยวกับการเชื่อมโยงระบบฐานข้อมูล Supabase, สูตรประเมินคลาดเคลื่อน หรือปรับแต่งหน้าใบสลิปพิมพ์ PDF ยินดีให้คำแนะนำช่วยเหลือผ่านวิศวกรและผู้ดูแลระบบ
            </p>

            <div className="space-y-3 pt-2 text-xs border-t border-white/5">
              <div className="flex items-center gap-2 text-gray-400 bg-black/20 p-2 rounded border border-white/5">
                <Mail className="w-4 h-4 text-[#D4AF37]" />
                <div>
                  <span className="block text-[10px] text-gray-500 font-mono">EMAIL CONTACT</span>
                  <a href="mailto:support@tech-sheet.co.th" className="hover:underline font-bold text-white text-[11px]">support@tech-sheet.co.th</a>
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-400 bg-black/20 p-2 rounded border border-white/5">
                <Phone className="w-4 h-4 text-emerald-500" />
                <div>
                  <span className="block text-[10px] text-gray-500 font-mono">HOTLINE SUPPORT (THAILAND)</span>
                  <span className="font-bold text-white text-[11px]">+66 2 123 4567 (จันทร์-ศุกร์)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-400 bg-black/20 p-2 rounded border border-white/5">
                <ExternalLink className="w-4 h-4 text-sky-400" />
                <div>
                  <span className="block text-[10px] text-gray-500 font-mono">SUPABASE CONSOLE</span>
                  <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="hover:underline font-bold text-sky-400 text-[11.5px] flex items-center gap-1">
                    Supabase Dashboard ↗
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-sm border ${bgCard} bg-[#D4AF37]/5 border-[#D4AF37]/20 space-y-3`}>
            <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase">
              <Layers className="w-4 h-4 text-[#D4AF37]" />
              ฟังก์ชันหลักที่รองรับแล้ว
            </div>
            <ul className="text-[11px] text-gray-400 space-y-1.5 list-disc pl-4">
              <li>ระบบแยกประเภท คัดกรองเศษชั่วโมงล่วงเวลาอัตโนมัติ</li>
              <li>การบันทึกโอที และหักพักเที่ยงสำหรับกะพนักงานปกติ</li>
              <li>ตารางรายงานเวลาพนักงานเดี่ยวและสรุปสะสมรอบประมวล</li>
              <li>การเบิกจ่ายสลิปเงินเดือนคำนวณหัก กยศ. และกองทุนประกันสังคม</li>
              <li>การนำเข้าข้อมูลครั้งละหลายกะอย่างง่ายดายผ่านพาสต์ Excel</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function labelText(isDark: boolean) {
  return isDark ? 'text-gray-450 font-mono text-[10px]' : 'text-slate-600 font-bold text-[10px]';
}
