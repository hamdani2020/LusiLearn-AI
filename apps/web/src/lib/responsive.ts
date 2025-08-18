// Responsive breakpoints matching Tailwind CSS
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// Container sizes for different screen sizes
export const containerSizes = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
} as const

// Grid system for responsive layouts
export const gridCols = {
  mobile: 'grid-cols-1',
  tablet: 'md:grid-cols-2',
  desktop: 'lg:grid-cols-3',
  wide: 'xl:grid-cols-4',
} as const

// Spacing system for consistent margins and padding
export const spacing = {
  xs: '0.5rem',
  sm: '1rem',
  md: '1.5rem',
  lg: '2rem',
  xl: '3rem',
  '2xl': '4rem',
} as const

// Typography scale for responsive text
export const typography = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
} as const

// Responsive utilities
export const responsive = {
  // Hide/show elements at different breakpoints
  hideOnMobile: 'hidden md:block',
  hideOnDesktop: 'block md:hidden',
  showOnTablet: 'hidden md:block lg:hidden',
  
  // Responsive padding and margins
  paddingResponsive: 'px-4 md:px-6 lg:px-8',
  marginResponsive: 'mx-4 md:mx-6 lg:mx-8',
  
  // Responsive text alignment
  textCenterMobile: 'text-center md:text-left',
  textLeftDesktop: 'text-center lg:text-left',
  
  // Responsive flex direction
  flexColMobile: 'flex-col md:flex-row',
  flexRowDesktop: 'flex-col lg:flex-row',
} as const

// Learning platform specific responsive patterns
export const learningResponsive = {
  // Dashboard layout
  dashboardGrid: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  dashboardGap: 'gap-4 md:gap-6',
  
  // Content cards
  contentGrid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  contentCardPadding: 'p-4 md:p-6',
  
  // Learning session layout
  sessionLayout: 'flex-col lg:flex-row',
  sessionSidebar: 'w-full lg:w-1/4',
  sessionContent: 'w-full lg:w-3/4',
  
  // Progress indicators
  progressBarHeight: 'h-2 md:h-3',
  progressText: 'text-sm md:text-base',
  
  // Navigation
  navPadding: 'px-4 md:px-6 lg:px-8',
  navHeight: 'h-14 md:h-16',
} as const