import { useId } from 'react';
import { Inline, Stack, Text } from '@atlaskit/primitives';
import Heading from '@atlaskit/heading';

// The only file in static/app/src allowed to contain colour literals (test/no-colour-literals):
// the AccessRadar brand mark is a fixed brand asset, not themed UI, so it cannot use ADS tokens.

/**
 * AccessRadar logo, Radrly icon family v3 (resources/icons/accessradar.svg, brand/accessradar-logo.svg):
 * white padlock with a radar sweep on the v3 gradient #8D6FDC → #8646CD (60%) → #7A36A9. Brand colours appear only here; the rest of the UI uses ADS tokens.
 */
const AR_SWEEP: Array<[string, number]> = [
  [
    'M521.5 607.8L521.5 -892.2L756.1 -873.8L985.0 -818.8L1202.5 -728.7L1403.2 -605.7L1582.1 -452.9L1735.0 -273.9L1858.0 -73.2L1948.1 144.3L2003.0 373.1L2021.5 607.8Z',
    0.0045,
  ],
  [
    'M521.5 607.8L619.6 -889.0L867.4 -851.8L1105.6 -773.8L1327.4 -657.3L1526.8 -505.5L1698.1 -322.6L1836.6 -113.7L1938.3 115.3L2000.5 358.1L2021.5 607.8Z',
    0.0091,
  ],
  [
    'M521.5 607.8L717.3 -879.4L951.7 -829.2L1175.1 -742.3L1381.8 -620.9L1566.6 -468.2L1724.7 -288.0L1852.0 -84.8L1945.3 136.0L2002.3 368.8L2021.5 607.8Z',
    0.0125,
  ],
  [
    'M521.5 607.8L814.1 -863.4L1061.3 -791.7L1292.6 -678.8L1501.2 -528.0L1681.0 -343.8L1826.6 -131.6L1933.8 102.4L1999.4 351.3L2021.5 607.8Z',
    0.0155,
  ],
  [
    'M521.5 607.8L909.7 -841.1L1140.5 -758.5L1354.8 -639.4L1546.9 -487.0L1711.5 -305.4L1844.4 -99.3L1941.9 125.6L2001.4 363.4L2021.5 607.8Z',
    0.0183,
  ],
  [
    'M521.5 607.8L1003.6 -812.6L1217.7 -720.8L1415.0 -597.0L1590.8 -444.2L1740.8 -265.9L1861.3 -66.6L1949.6 148.9L2003.4 375.6L2021.5 607.8Z',
    0.0211,
  ],
  [
    'M521.5 607.8L1095.5 -778.0L1319.5 -662.3L1521.0 -510.7L1694.2 -327.5L1834.3 -117.8L1937.3 112.4L2000.3 356.5L2021.5 607.8Z',
    0.0238,
  ],
  [
    'M521.5 607.8L1184.9 -737.5L1389.5 -615.6L1572.2 -462.8L1728.4 -283.0L1854.1 -80.7L1946.3 138.9L2002.6 370.4L2021.5 607.8Z',
    0.0265,
  ],
  [
    'M521.5 607.8L1271.5 -691.3L1456.7 -565.0L1621.1 -412.5L1760.8 -237.2L1872.9 -43.0L1954.8 165.6L2004.7 384.2L2021.5 607.8Z',
    0.0294,
  ],
  [
    'M521.5 607.8L1354.8 -639.4L1546.9 -487.0L1711.5 -305.4L1844.4 -99.3L1941.9 125.6L2001.4 363.4L2021.5 607.8Z',
    0.0324,
  ],
  [
    'M521.5 607.8L1434.6 -582.3L1605.0 -429.5L1750.2 -252.6L1866.8 -55.7L1952.1 156.7L2004.0 379.6L2021.5 607.8Z',
    0.0355,
  ],
  [
    'M521.5 607.8L1510.5 -520.0L1687.2 -336.2L1830.2 -125.2L1935.4 107.1L1999.8 353.8L2021.5 607.8Z',
    0.0389,
  ],
  [
    'M521.5 607.8L1582.1 -452.9L1735.0 -273.9L1858.0 -73.2L1948.1 144.3L2003.0 373.1L2021.5 607.8Z',
    0.0426,
  ],
  [
    'M521.5 607.8L1649.2 -381.2L1779.5 -209.2L1883.7 -20.2L1959.7 181.8L2006.0 392.5L2021.5 607.8Z',
    0.0466,
  ],
  ['M521.5 607.8L1711.5 -305.4L1844.4 -99.3L1941.9 125.6L2001.4 363.4L2021.5 607.8Z', 0.051],
  ['M521.5 607.8L1768.7 -225.6L1877.5 -33.6L1956.9 172.4L2005.2 387.7L2021.5 607.8Z', 0.0559],
  ['M521.5 607.8L1820.5 -142.2L1907.3 33.8L1970.4 219.5L2008.6 412.0L2021.5 607.8Z', 0.0615],
  ['M521.5 607.8L1866.8 -55.7L1952.1 156.7L2004.0 379.6L2021.5 607.8Z', 0.0678],
  ['M521.5 607.8L1907.3 33.8L1970.4 219.5L2008.6 412.0L2021.5 607.8Z', 0.0753],
  ['M521.5 607.8L1941.9 125.6L2001.4 363.4L2021.5 607.8Z', 0.084],
  ['M521.5 607.8L1970.4 219.5L2008.6 412.0L2021.5 607.8Z', 0.0945],
  ['M521.5 607.8L1992.7 315.1L2014.3 460.8L2021.5 607.8Z', 0.1074],
  ['M521.5 607.8L2008.6 412.0L2021.5 607.8Z', 0.1236],
  ['M521.5 607.8L2018.3 509.7L2021.5 607.8Z', 0.1448],
];
const AR_BODY =
  'M362.9 461.7L680.1 461.7A80.0 80.0 0 0 1 760.1 541.7L760.1 673.9A80.0 80.0 0 0 1 680.1 753.9L362.9 753.9A80.0 80.0 0 0 1 282.9 673.9L282.9 541.7A80.0 80.0 0 0 1 362.9 461.7Z';

export function BrandMark({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  const bg = `ar-bg-${id}`;
  const clip = `ar-clip-${id}`;
  return (
    // eslint-disable-next-line @atlaskit/design-system/no-html-image -- the brand mark is a fixed brand asset (inline SVG with its own gradient), not an ADS image.
    <svg
      width={size}
      height={size}
      viewBox="0 0 1043 1043"
      fill="none"
      role="img"
      aria-label="AccessRadar"
    >
      <title>AccessRadar</title>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1043" y2="1043" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8D6FDC" />
          <stop offset="0.6" stopColor="#8646CD" />
          <stop offset="1" stopColor="#7A36A9" />
        </linearGradient>
        <clipPath id={clip}>
          <path d={AR_BODY} />
        </clipPath>
      </defs>
      <rect width="1043" height="1043" rx="230" fill={`url(#${bg})`} />
      <g clipPath={`url(#${clip})`}>
        {AR_SWEEP.map(([d, o], i) => (
          <path key={i} d={d} fill="white" fillOpacity={o} />
        ))}
        <path d="M521.5 607.8L2021.5 607.8" stroke="white" strokeWidth="14" strokeOpacity="0.95" />
      </g>
      <path d={AR_BODY} stroke="white" strokeWidth="47" strokeLinejoin="round" />
      <path
        d="M396.2 461.7L396.2 372.2A125.2 125.2 0 0 1 646.7 372.2L646.7 461.7"
        stroke="white"
        strokeWidth="47"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="521.5" cy="607.8" r="46" fill="white" />
    </svg>
  );
}

/** Logo + product name + subtitle at the top of the navigation (ADS Inline, Heading, Text). */
export function BrandHeader({ subtitle }: { subtitle: string }) {
  return (
    <Inline space="space.150" alignBlock="center">
      <BrandMark />
      <Stack>
        <Heading size="xsmall" as="span">
          AccessRadar
        </Heading>
        <Text size="small" color="color.text.subtle">
          {subtitle}
        </Text>
      </Stack>
    </Inline>
  );
}
