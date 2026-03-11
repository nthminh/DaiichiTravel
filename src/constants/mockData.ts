import { TripStatus, SeatStatus } from './translations';

export const MOCK_AGENTS = [
  { id: '1', name: 'Đại lý Hoàn Kiếm', code: 'DL001', username: 'agent_hk', password: '123', phone: '0912345678', email: 'hk@daiichi.vn', commissionRate: 15, balance: 5000000, status: 'ACTIVE' },
  { id: '2', name: 'Đại lý Cầu Giấy', code: 'DL002', username: 'agent_cg', password: '123', phone: '0987654321', email: 'cg@daiichi.vn', commissionRate: 12, balance: 2500000, status: 'ACTIVE' },
  { id: '3', name: 'Đại lý Long Biên', code: 'DL003', username: 'agent_lb', password: '123', phone: '0905556667', email: 'lb@daiichi.vn', commissionRate: 10, balance: 0, status: 'LOCKED' },
];

export const MOCK_ROUTES = [
  { id: '1', stt: 1, name: 'Hà Nội - Cát Bà', departurePoint: '96 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội', arrivalPoint: '217 Đường 1/4, Cát Bà, Hải Phòng', price: 300000 },
  { id: '2', stt: 2, name: 'Cát Bà - Hà Nội', departurePoint: '217 Đường 1/4, Cát Bà, Hải Phòng', arrivalPoint: '96 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội', price: 300000 },
  { id: '3', stt: 3, name: 'Hà Nội - Ninh Bình', departurePoint: '96 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội', arrivalPoint: 'Tam Cốc, Ninh Bình', price: 250000, priceChild: 200000 },
  { id: '4', stt: 4, name: 'Ninh Bình - Hà Nội', departurePoint: 'Tam Cốc, Ninh Bình', arrivalPoint: '96 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội', price: 250000, priceChild: 200000 },
  { id: '5', stt: 5, name: 'Hà Nội - Sapa', departurePoint: '96 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội', arrivalPoint: 'Bến xe Sapa', price: 0 },
];

export const MOCK_VEHICLES = [
  { id: '1', licensePlate: '29B-123.45', type: 'Limousine 11 chỗ', seats: 11, registrationExpiry: '2024-12-31', status: 'ACTIVE' },
  { id: '2', licensePlate: '29B-678.90', type: 'Universe 45 chỗ', seats: 45, registrationExpiry: '2025-06-30', status: 'ACTIVE' },
  { id: '3', licensePlate: '15B-001.23', type: 'Sleeper 34 giường', seats: 34, registrationExpiry: '2024-10-15', status: 'MAINTENANCE' },
  { id: '4', licensePlate: '35B-009.88', type: 'Limousine 11 chỗ', seats: 11, registrationExpiry: '2025-12-31', status: 'ACTIVE' },
];

export const MOCK_TOURS = [
  { 
    id: '1', 
    title: 'Tour Lan Hạ 1 Ngày', 
    description: 'Khám phá vẻ đẹp hoang sơ của Vịnh Lan Hạ, chèo kayak, tắm biển tại bãi tắm Ba Trái Đào.',
    image: 'https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/tourlanha.png?alt=media&token=4be06677-5484-4225-a48f-2a7f92dc99f4',
    priceAdult: 1200000,
    priceChild: 900000,
    duration: '1 Ngày'
  },
  { 
    id: '2', 
    title: 'Tour Ninh Bình 2N1Đ', 
    description: 'Tham quan Tràng An, Bái Đính, Hang Múa và nghỉ dưỡng tại resort cao cấp.',
    image: 'https://firebasestorage.googleapis.com/v0/b/daiichitravel-f49fd.firebasestorage.app/o/tourninhbinh.png?alt=media&token=4be06677-5484-4225-a48f-2a7f92dc99f4',
    priceAdult: 2500000,
    priceChild: 1800000,
    duration: '2 Ngày 1 Đêm'
  }
];

export const MOCK_TRIPS = [
  { 
    id: '1', 
    time: '08:00', 
    route: 'Hà Nội - Cát Bà', 
    driverName: 'Nguyễn Văn Hùng', 
    licensePlate: '29B-123.45', 
    price: 300000,
    status: TripStatus.WAITING,
    seats: Array.from({ length: 11 }, (_, i) => ({ id: `A${i+1}`, status: i < 4 ? SeatStatus.PAID : i < 6 ? SeatStatus.BOOKED : SeatStatus.EMPTY }))
  },
  { 
    id: '2', 
    time: '10:30', 
    route: 'Hà Nội - Cát Bà', 
    driverName: 'Trần Minh Tuấn', 
    licensePlate: '29B-678.90', 
    price: 300000,
    status: TripStatus.WAITING,
    seats: Array.from({ length: 45 }, (_, i) => ({ id: `B${i+1}`, status: i < 15 ? SeatStatus.PAID : SeatStatus.EMPTY }))
  },
  { 
    id: '3', 
    time: '14:00', 
    route: 'Cát Bà - Hà Nội', 
    driverName: 'Lê Hoàng Nam', 
    licensePlate: '29B-123.45', 
    price: 300000,
    status: TripStatus.WAITING,
    seats: Array.from({ length: 11 }, (_, i) => ({ id: `A${i+1}`, status: SeatStatus.EMPTY }))
  },
  // Hà Nội - Ninh Bình
  { id: '4', time: '08:00', route: 'Hà Nội - Ninh Bình', driverName: 'Vũ Văn Mạnh', licensePlate: '35B-009.88', price: 250000, priceChild: 200000, status: TripStatus.WAITING, seats: Array.from({ length: 11 }, (_, i) => ({ id: `A${i+1}`, status: SeatStatus.EMPTY })) },
  { id: '5', time: '09:00', route: 'Hà Nội - Ninh Bình', driverName: 'Vũ Văn Mạnh', licensePlate: '35B-009.88', price: 250000, priceChild: 200000, status: TripStatus.WAITING, seats: Array.from({ length: 11 }, (_, i) => ({ id: `A${i+1}`, status: SeatStatus.EMPTY })) },
  { id: '6', time: '13:00', route: 'Hà Nội - Ninh Bình', driverName: 'Vũ Văn Mạnh', licensePlate: '35B-009.88', price: 250000, priceChild: 200000, status: TripStatus.WAITING, seats: Array.from({ length: 11 }, (_, i) => ({ id: `A${i+1}`, status: SeatStatus.EMPTY })) },
  { id: '7', time: '16:00', route: 'Hà Nội - Ninh Bình', driverName: 'Vũ Văn Mạnh', licensePlate: '35B-009.88', price: 250000, priceChild: 200000, status: TripStatus.WAITING, seats: Array.from({ length: 11 }, (_, i) => ({ id: `A${i+1}`, status: SeatStatus.EMPTY })) },
  // Ninh Bình - Hà Nội
  { id: '8', time: '11:00', route: 'Ninh Bình - Hà Nội', driverName: 'Đặng Văn Tiến', licensePlate: '35B-009.88', price: 250000, priceChild: 200000, status: TripStatus.WAITING, seats: Array.from({ length: 11 }, (_, i) => ({ id: `A${i+1}`, status: SeatStatus.EMPTY })) },
  { id: '9', time: '13:00', route: 'Ninh Bình - Hà Nội', driverName: 'Đặng Văn Tiến', licensePlate: '35B-009.88', price: 250000, priceChild: 200000, status: TripStatus.WAITING, seats: Array.from({ length: 11 }, (_, i) => ({ id: `A${i+1}`, status: SeatStatus.EMPTY })) },
  { id: '10', time: '18:00', route: 'Ninh Bình - Hà Nội', driverName: 'Đặng Văn Tiến', licensePlate: '35B-009.88', price: 250000, priceChild: 200000, status: TripStatus.WAITING, seats: Array.from({ length: 11 }, (_, i) => ({ id: `A${i+1}`, status: SeatStatus.EMPTY })) },
  { id: '11', time: '19:00', route: 'Ninh Bình - Hà Nội', driverName: 'Đặng Văn Tiến', licensePlate: '35B-009.88', price: 250000, priceChild: 200000, status: TripStatus.WAITING, seats: Array.from({ length: 11 }, (_, i) => ({ id: `A${i+1}`, status: SeatStatus.EMPTY })) },
];

export const MOCK_CONSIGNMENTS = [
  { id: 'DX-001', sender: 'Nguyễn Văn A', receiver: 'Trần Thị B', type: 'Tài liệu', weight: '0.5kg', cod: 0, status: 'DELIVERED', date: '2024-03-11' },
  { id: 'DX-002', sender: 'Lê Văn C', receiver: 'Phạm Minh D', type: 'Hàng điện tử', weight: '2.0kg', cod: 5000000, status: 'IN_TRANSIT', date: '2024-03-11' },
];
