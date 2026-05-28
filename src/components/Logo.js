import React from 'react';
import { View, Text } from 'react-native';

export function LogoMark({ size = 40, style }) {
  const r = Math.round(size * 0.22);
  const dotSize = Math.round(size * 0.1);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: '#1A1A2E',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {/* Purple top-right accent ring */}
      <View
        style={{
          position: 'absolute',
          top: -size * 0.15,
          right: -size * 0.15,
          width: size * 0.55,
          height: size * 0.55,
          borderRadius: size * 0.275,
          borderWidth: 2,
          borderColor: '#6C63FF',
          opacity: 0.25,
        }}
      />

      {/* C lettermark */}
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: Math.round(size * 0.46),
          fontWeight: '900',
          letterSpacing: -1,
          lineHeight: Math.round(size * 0.5),
          marginBottom: dotSize * 0.6,
        }}
      >
        C
      </Text>

      {/* Three-dot brand accent */}
      <View style={{ flexDirection: 'row', gap: dotSize * 0.6, alignItems: 'center' }}>
        {[0.4, 1, 0.4].map((opacity, i) => (
          <View
            key={i}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: '#6C63FF',
              opacity,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function LogoFull({ iconSize = 36, light = false, style }) {
  const textColor = light ? '#FFFFFF' : '#1A1A2E';
  const subColor = light ? '#8E8E9388' : '#8E8E93';

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>
      <LogoMark size={iconSize} />
      <View>
        <Text
          style={{
            fontSize: Math.round(iconSize * 0.42),
            fontWeight: '800',
            color: textColor,
            letterSpacing: -0.3,
            lineHeight: Math.round(iconSize * 0.46),
          }}
        >
          Cholesterol
        </Text>
        <Text
          style={{
            fontSize: Math.round(iconSize * 0.26),
            fontWeight: '500',
            color: subColor,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          Tracker
        </Text>
      </View>
    </View>
  );
}
