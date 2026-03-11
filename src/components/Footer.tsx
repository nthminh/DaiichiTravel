import React from 'react';
import { Facebook, Youtube, Instagram, Globe, Phone, Mail, MapPin } from 'lucide-react';
import { Language, TRANSLATIONS } from '../App';

interface FooterProps {
  language: Language;
}

export const Footer: React.FC<FooterProps> = ({ language }) => {
  const t = TRANSLATIONS[language];

  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8 px-8 mt-12 rounded-t-[40px]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
        <div className="space-y-6">
          <img 
            src="https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/daiichilogo.png?alt=media&token=bcc9d130-5370-42e2-b0f6-d0b4a3b32724" 
            alt="Daiichi Logo" 
            className="h-10"
          />
          <p className="text-gray-500 text-sm leading-relaxed">
            {language === 'vi' 
              ? 'Công ty tổ chức tour du lịch chất lượng cao tại Miền Bắc. Chuyên cung cấp dịch vụ vận tải hành khách và tour du lịch chuyên nghiệp.' 
              : 'High-quality tour operator in Northern Vietnam. Specialized in professional passenger transport and tour services.'}
          </p>
          <div className="flex gap-4">
            <a href="https://www.facebook.com/Fanpagedaiichitravel" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-daiichi-red hover:bg-red-50 transition-all">
              <Facebook size={20} />
            </a>
            <a href="https://www.youtube.com/@daiichitravel63" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-daiichi-red hover:bg-red-50 transition-all">
              <Youtube size={20} />
            </a>
            <a href="https://www.instagram.com/daiichi_travel_official/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-daiichi-red hover:bg-red-50 transition-all">
              <Instagram size={20} />
            </a>
            <a href="https://daiichitravel.com/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:text-daiichi-red hover:bg-red-50 transition-all">
              <Globe size={20} />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-bold mb-6 uppercase text-xs tracking-widest text-gray-400">{language === 'vi' ? 'Liên kết' : 'Links'}</h4>
          <ul className="space-y-4">
            <li><a href="https://daiichitravel.com/" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-daiichi-red transition-colors text-sm font-medium">{language === 'vi' ? 'Trang web chính thức' : 'Official Website'}</a></li>
            <li><a href="#" className="text-gray-600 hover:text-daiichi-red transition-colors text-sm font-medium">{t.book_ticket}</a></li>
            <li><a href="#" className="text-gray-600 hover:text-daiichi-red transition-colors text-sm font-medium">{t.tours}</a></li>
            <li><a href="#" className="text-gray-600 hover:text-daiichi-red transition-colors text-sm font-medium">{language === 'vi' ? 'Chính sách bảo mật' : 'Privacy Policy'}</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-6 uppercase text-xs tracking-widest text-gray-400">{language === 'vi' ? 'Liên hệ' : 'Contact'}</h4>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <Phone size={18} className="text-daiichi-red mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-800">+84 96 100 47 09</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Hotline 24/7</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Mail size={18} className="text-daiichi-red mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-800">info@daiichitravel.com</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Email</p>
              </div>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-6 uppercase text-xs tracking-widest text-gray-400">{language === 'vi' ? 'Văn phòng' : 'Office'}</h4>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <MapPin size={18} className="text-daiichi-red mt-0.5" />
              <p className="text-sm text-gray-600 leading-relaxed">
                {language === 'vi' 
                  ? '96 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội' 
                  : '96 Nguyen Huu Huan, Hoan Kiem, Hanoi'}
              </p>
            </li>
          </ul>
        </div>
      </div>

      <div className="pt-8 border-t border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-gray-400 font-medium">
          © 2026 Daiichi Travel. All rights reserved.
        </p>
        <div className="flex gap-6">
          <a href="#" className="text-xs text-gray-400 hover:text-daiichi-red transition-colors font-medium">Terms of Service</a>
          <a href="#" className="text-xs text-gray-400 hover:text-daiichi-red transition-colors font-medium">Privacy Policy</a>
        </div>
      </div>
    </footer>
  );
};
