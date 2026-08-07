package kr.hyuni.dialogue;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

final class ExpressionRules {
    private ExpressionRules() {}

    static boolean compare(String actual, String operator, String expected) {
        String op = operator == null ? "EQ" : operator.toUpperCase(java.util.Locale.ROOT);
        boolean unset = actual == null;
        if (op.equals("IS_SET")) return !unset;
        if (op.equals("IS_UNSET")) return unset;
        boolean expectedUnset = expected == null || List.of("null", "none", "미설정").contains(expected.strip().toLowerCase(java.util.Locale.ROOT));
        if (expectedUnset) return op.equals("NE") ? !unset : unset;
        if (unset) return op.equals("NE");
        int order;
        try { order = new BigDecimal(actual.strip()).compareTo(new BigDecimal(expected.strip())); }
        catch (NumberFormatException ignored) { order = actual.compareTo(expected); }
        return switch (op) {
            case "NE" -> order != 0;
            case "GT" -> order > 0;
            case "GTE" -> order >= 0;
            case "LT" -> order < 0;
            case "LTE" -> order <= 0;
            default -> actual.equalsIgnoreCase(expected);
        };
    }

    static boolean combine(List<Boolean> values, String logic) {
        if (values.isEmpty()) return false;
        return switch (logic == null ? "AND" : logic.toUpperCase(java.util.Locale.ROOT)) {
            case "OR" -> values.stream().anyMatch(Boolean::booleanValue);
            case "XOR" -> values.stream().filter(Boolean::booleanValue).count() == 1;
            case "NOT" -> values.stream().noneMatch(Boolean::booleanValue);
            default -> values.stream().allMatch(Boolean::booleanValue);
        };
    }

    static String calculate(String current, String operator, String operand) {
        String value = operand == null ? "" : operand.strip();
        if (operator == null || operator.equals("="))
            return value.equalsIgnoreCase("true") || value.equalsIgnoreCase("false") ? value.toLowerCase(java.util.Locale.ROOT) : value;
        if (operator.equals("+=") && !isNumber(current) || operator.equals("+=") && !isNumber(value))
            return (current == null ? "" : current) + value;
        try {
            BigDecimal left = new BigDecimal(current == null || current.isBlank() ? "0" : current.strip());
            BigDecimal right = new BigDecimal(value);
            BigDecimal result = switch (operator) {
                case "+=" -> left.add(right);
                case "-=" -> left.subtract(right);
                case "*=" -> left.multiply(right);
                case "/=" -> right.compareTo(BigDecimal.ZERO) == 0 ? left : left.divide(right, 8, RoundingMode.HALF_UP);
                default -> right;
            };
            return result.stripTrailingZeros().toPlainString();
        } catch (NumberFormatException ignored) { return current == null ? "" : current; }
    }

    private static boolean isNumber(String value) {
        if (value == null || value.isBlank()) return false;
        try { new BigDecimal(value.strip()); return true; }
        catch (NumberFormatException ignored) { return false; }
    }

    public static void main(String[] args) {
        assert compare(null, "IS_UNSET", "");
        assert compare("10", "GT", "2");
        assert combine(List.of(true, false), "XOR");
        assert calculate("5", "+=", "3").equals("8");
        assert calculate("true", "=", "FALSE").equals("false");
    }
}
