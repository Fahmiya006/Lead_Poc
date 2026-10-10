// One lead in the list. Name, email and submission time are the three
// fields the brief calls out, so they get their own styled spots; anything
// else the form collected (phone, company, etc.) still shows below,
// generically, so the card works for any form shape without hard-coding
// every possible field name.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const NAME_KEYS = ['full_name', 'first_name', 'name'];
const EMAIL_KEYS = ['email'];

// "company_name" -> "Company name"
function prettyLabel(key) {
  const text = key.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pick(answers, keys) {
  for (const key of keys) {
    if (answers[key]) return answers[key];
  }
  return null;
}

function initialOf(name, email) {
  const source = name || email || '?';
  return source.charAt(0).toUpperCase();
}

// Shows "Oct 9, 2:14 PM" rather than just a time, since a lead from
// yesterday and one from today would otherwise look identical. Falls back
// to a plain label instead of letting an invalid/missing created_time
// render as the native "Invalid Date" string.
function formatSubmittedAt(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Time unknown';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LeadCard({ lead, isLatest }) {
  const answers = lead.answers || {};
  const name = pick(answers, NAME_KEYS);
  const email = pick(answers, EMAIL_KEYS);
  const featuredKeys = new Set(
    [...NAME_KEYS, ...EMAIL_KEYS].filter((key) => key in answers)
  );
  const otherFields = Object.entries(answers).filter(([key]) => !featuredKeys.has(key));

  return (
    <View style={[styles.card, isLatest && styles.latest]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialOf(name, email)}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.name}>{name || 'No name given'}</Text>
        <Text style={styles.email}>{email || 'No email given'}</Text>

        {otherFields.map(([key, value]) => (
          <Text key={key} style={styles.line}>
            <Text style={styles.label}>{prettyLabel(key)}: </Text>
            {value}
          </Text>
        ))}

        <Text style={styles.time}>Received {formatSubmittedAt(lead.submittedAt)}</Text>
      </View>

      {isLatest && <Text style={styles.badge}>NEW</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1c2333',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a3347',
  },
  latest: { borderColor: '#4ade80' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { flex: 1 },
  name: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  email: { color: '#93c5fd', fontSize: 14, marginBottom: 6 },
  line: { color: '#e5e7eb', fontSize: 15, marginBottom: 3 },
  label: { color: '#94a3b8' },
  time: { color: '#64748b', fontSize: 12, marginTop: 6 },
  badge: { color: '#4ade80', fontSize: 11, fontWeight: '700' },
});
