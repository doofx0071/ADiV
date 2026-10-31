import { useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { AppText as Text } from "@/components/app-text";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { Pencil, Plus, Trash2, X } from "lucide-react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { api, type Id } from "@/lib/api";
import { AppButton, Card, ChoiceRow, EmptyState, LoadingState, Page } from "@/components/ui";
import { dateLabel, php } from "@/lib/format";
import { useAppTheme } from "@/lib/theme";

export default function ExpensesScreen() {
  const expenses = useQuery(api.expenses.getExpenses, { limit: 1000 });
  const stats = useQuery(api.expenses.getExpenseStats);
  const deleteExpense = useMutation(api.expenses.deleteExpense);
  const [filter, setFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const { colors } = useAppTheme();

  // Receipts attached from the web app resolve through the same storage API
  const receiptIds = (expenses ?? [])
    .map((expense) => expense.receiptPhoto)
    .filter((id): id is Id<"_storage"> => typeof id === "string");
  const fileUrls = useQuery(
    api.files.getFileUrls,
    receiptIds.length > 0 ? { storageIds: receiptIds } : { storageIds: [] }
  );
  const urlById = new Map((fileUrls ?? []).map((f) => [f.storageId, f.url]));

  function confirmDelete(expenseId: string) {
    Alert.alert("Delete this expense?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        setDeletingId(expenseId);
        void deleteExpense({ expenseId: expenseId as Id<"expenses"> })
          .catch((error) => Alert.alert("Could not delete", error instanceof Error ? error.message : "Please try again."))
          .finally(() => setDeletingId(null));
      } },
    ]);
  }

  if (expenses === undefined || stats === undefined) {
    return <Page back><LoadingState label="Loading expenses…" /></Page>;
  }

  const visible = expenses.filter((expense) => filter === "all" || expense.category === filter);
  const filterOptions = [
    { value: "all", label: "All" },
    ...stats.byCategory.map((c) => ({ value: c.category, label: `${c.category} · ${php(c.amount)}` })),
  ];

  return (
    <Page back eyebrow="Your records" title="Expenses" subtitle={`${php(stats.totalAmount)} across ${stats.count} ${stats.count === 1 ? "entry" : "entries"}`}>
      <AppButton label="Add expense" onPress={() => router.push({ pathname: "/log/[type]", params: { type: "expense" } })} icon={<Plus size={17} color="#ffffff" />} />
      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Swipe left to edit · swipe right to delete</Text>

      {stats.byCategory.length > 0 ? (
        <ChoiceRow value={filter} options={filterOptions} onChange={setFilter} />
      ) : null}

      {visible.map((expense) => {
        const receipt = expense.receiptPhoto ? urlById.get(expense.receiptPhoto) : undefined;
        return (
          <ReanimatedSwipeable
            key={expense._id}
            friction={2}
            leftThreshold={48}
            rightThreshold={48}
            overshootLeft={false}
            overshootRight={false}
            renderLeftActions={() => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete expense"
                onPress={() => confirmDelete(expense._id)}
                disabled={deletingId === expense._id}
                style={{ width: 88, minHeight: 92, alignSelf: "stretch", backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", gap: 5, opacity: deletingId === expense._id ? 0.6 : 1 }}
              >
                <Trash2 size={19} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "900" }}>Delete</Text>
              </Pressable>
            )}
            renderRightActions={() => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit expense"
                onPress={() => router.push({ pathname: "/history/edit", params: { type: "expense", id: expense._id } })}
                style={{ width: 88, minHeight: 92, alignSelf: "stretch", backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", gap: 5 }}
              >
                <Pencil size={19} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "900" }}>Edit</Text>
              </Pressable>
            )}
          >
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
                      {expense.description || expense.category}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{dateLabel(expense.date)}</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>
                    {expense.category} · {php(expense.amount)}
                  </Text>
                </View>
                {expense.receiptPhoto && receipt ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View receipt"
                    onPress={() => setReceiptUrl(receipt)}
                    style={{ width: 48, height: 48, borderRadius: 0, overflow: "hidden", backgroundColor: colors.secondary }}
                  >
                    <Image source={{ uri: receipt }} alt="Expense receipt" contentFit="cover" style={{ width: "100%", height: "100%" }} />
                  </Pressable>
                ) : null}
              </View>
            </Card>
          </ReanimatedSwipeable>
        );
      })}

      {expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          body="Log parts, accessories, insurance, and other costs to see them here."
          action={<AppButton label="Add your first expense" onPress={() => router.push({ pathname: "/log/[type]", params: { type: "expense" } })} />}
        />
      ) : visible.length === 0 ? (
        <EmptyState title={`No ${filter} entries yet`} body="Pick another category or add a new expense." />
      ) : null}

      <Modal visible={receiptUrl !== null} animationType="fade" transparent onRequestClose={() => setReceiptUrl(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.94)", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close receipt" onPress={() => setReceiptUrl(null)} style={{ position: "absolute", top: 48, right: 22, zIndex: 2, width: 44, height: 44, borderRadius: 0, backgroundColor: "#24242d", alignItems: "center", justifyContent: "center" }}><X color="#fff" size={20} /></Pressable>
          {receiptUrl ? <Image source={{ uri: receiptUrl }} alt="Expense receipt" contentFit="contain" style={{ width: "100%", height: "78%" }} /> : null}
        </View>
      </Modal>
    </Page>
  );
}
