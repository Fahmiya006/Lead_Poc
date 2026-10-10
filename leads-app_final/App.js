// The only screen: a live list of leads.

import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLiveLeads } from './src/useLiveLeads';
import LeadCard from './src/LeadCard';

export default function App() {
  const { leads, online, latestId, status } = useLiveLeads();

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Incoming leads</Text>
          <Text style={styles.count}>{leads.length} total</Text>
        </View>
        <View style={[styles.pill, online ? styles.pillOn : styles.pillOff]}>
          <Text style={styles.pillText}>{online ? 'LIVE' : 'RECONNECTING'}</Text>
        </View>
      </View>

      {status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color="#4ade80" />
          <Text style={styles.centerText}>Loading leads…</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.centerTitle}>Couldn't load leads</Text>
          <Text style={styles.centerText}>
            Check that the backend URL in config.js is correct and the server is running.
          </Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(lead) => lead.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <LeadCard lead={item} isLatest={item.id === latestId} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No leads yet.{'\n'}Submit the form and it will show up here.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f1420' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 14,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  count: { color: '#94a3b8', marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillOn: { backgroundColor: '#166534' },
  pillOff: { backgroundColor: '#7f1d1d' },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  list: { paddingHorizontal: 18, paddingBottom: 30 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 80, lineHeight: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  centerText: { color: '#94a3b8', textAlign: 'center', marginTop: 10, lineHeight: 20 },
});
