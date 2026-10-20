import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { chatWithAI, getInitialAnalysis } from '../utils/aiService';
import { useGlobalContext } from './globalProvider';
import { useTranslation } from 'react-i18next';

const ChatInterface = ({ summary, transactions, onClose }) => {
    const insets = useSafeAreaInsets();
    const { state } = useGlobalContext();
    const isLight = state?.theme === 'light';
    const { t } = useTranslation();

    const [messages, setMessages] = useState(() => [
        {
            id: '1',
            text: t("Hi! I'm your personal finance advisor from FinFit. I'm analyzing your financial data...") || "Hi! I'm your personal finance advisor from FinFit. I'm analyzing your financial data...",
            isUser: false,
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const flatListRef = useRef();

    const suggestedQueries = useMemo(() => [
        t('Tell me about my expenses 💳') || 'Tell me about my expenses 💳',
        t('How can I save money? 💰') || 'How can I save money? 💰',
        t('Help me budget 📊') || 'Help me budget 📊',
        t('Food & canteen tips 🍔') || 'Food & canteen tips 🍔',
    ], [state.language]);

    useEffect(() => {
        let isMounted = true;
        const fetchInitialAnalysis = async () => {
            try {
                const analysis = await getInitialAnalysis(summary, transactions, state.language);
                if (isMounted) {
                    setMessages(prev => [
                        ...prev,
                        {
                            id: Date.now().toString(),
                            text: analysis,
                            isUser: false,
                        }
                    ]);
                }
            } catch (error) {
                console.error('Initial analysis error:', error);
                if (isMounted) {
                    setMessages(prev => [
                        ...prev,
                        {
                            id: Date.now().toString(),
                            text: t("I encountered an error analyzing your data. Feel free to ask me specific questions about your finances.") || "I encountered an error analyzing your data. Feel free to ask me specific questions about your finances.",
                            isUser: false,
                        }
                    ]);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchInitialAnalysis();
        return () => { isMounted = false; };
    }, [summary, transactions, state.language]);

    const handleSend = async (customText = null) => {
        const textToSend = (typeof customText === 'string' ? customText : inputText).trim();
        if (!textToSend || isLoading) return;

        const userMessage = {
            id: Date.now().toString(),
            text: textToSend,
            isUser: true,
        };

        setMessages(prev => [...prev, userMessage]);
        if (!customText) {
            setInputText('');
        }
        setIsLoading(true);

        try {
            // Passes current active state.language. If language changed, new reply is in active language.
            const response = await chatWithAI(textToSend, summary, transactions, state.language);
            const aiMessage = {
                id: (Date.now() + 1).toString(),
                text: response,
                isUser: false,
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = {
                id: (Date.now() + 1).toString(),
                text: t('Sorry, I encountered an error. Please try again.') || 'Sorry, I encountered an error. Please try again.',
                isUser: false,
            };
            setMessages(prev => [...prev, errorMessage]);
        }

        setIsLoading(false);
    };

    // Comprehensive markdown cleaner that strips ALL asterisks and formats cleanly
    const parseMessageText = (text, isUser) => {
        if (!text) return '';
        if (isUser) return text;
        
        let cleanText = text;
        // Strip markdown headers
        cleanText = cleanText.replace(/^#{1,6}\s+/gm, '');
        // Strip bold+italic (***text***)
        cleanText = cleanText.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
        // Strip bold (**text**)
        cleanText = cleanText.replace(/\*\*([^*]+)\*\*/g, '$1');
        // Strip italic (*text*)
        cleanText = cleanText.replace(/\*([^*\n]+)\*/g, '$1');
        // Convert markdown bullets (* item or - item) into clean bullet
        cleanText = cleanText.replace(/^(\s*)[\*\-]\s+/gm, '$1• ');
        // Remove ANY and ALL remaining stray asterisks from the text
        cleanText = cleanText.replace(/\*/g, '');
        // Clean excessive line breaks
        cleanText = cleanText.replace(/\n{3,}/g, '\n\n');
        
        return cleanText.trim();
    };

    const renderMessage = ({ item }) => {
        const textContent = parseMessageText(item.text, item.isUser);
        return (
            <View
                style={[
                    styles.messageContainer,
                    item.isUser
                        ? styles.userMessage
                        : [
                            styles.aiMessage,
                            isLight && { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }
                        ],
                ]}
            >
                {!item.isUser && (
                    <View style={styles.aiAvatarRow}>
                        <View style={[styles.aiAvatar, isLight && { backgroundColor: 'rgba(5, 150, 105, 0.12)' }]}>
                            <Ionicons name="sparkles" size={wp('3.5%')} color={isLight ? '#059669' : COLORS.secondary} />
                        </View>
                        <Text style={[styles.aiLabel, isLight && { color: '#059669' }]}>
                            {t("FinFit AI Advisor") || "FinFit AI Advisor"}
                        </Text>
                    </View>
                )}
                <Text style={[
                    styles.messageText,
                    item.isUser ? styles.userMessageText : [styles.aiMessageText, isLight && { color: '#0F172A' }],
                ]}>
                    {textContent}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, isLight && { backgroundColor: '#F8F9FA' }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={[styles.container, isLight && { backgroundColor: '#F8F9FA' }]}
                keyboardVerticalOffset={Platform.OS === 'ios' ? hp('2%') : 0}
            >
                <View style={[styles.header, isLight && { backgroundColor: '#FFFFFF', borderBottomColor: '#E2E8F0' }]}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerIcon}>
                            <Ionicons name="chatbubbles" size={wp('5%')} color="#FFFFFF" />
                        </View>
                        <View>
                            <Text style={[styles.headerText, isLight && { color: '#0F172A' }]}>
                                {t("Financial Advisor") || "Financial Advisor"}
                            </Text>
                            <Text style={{ fontSize: wp('2.8%'), color: isLight ? '#059669' : COLORS.secondary }}>
                                {t("Powered by FinFit AI") || "Powered by FinFit AI"}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={wp('7%')} color={isLight ? '#64748B' : COLORS.text.secondary} />
                    </TouchableOpacity>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={[styles.messagesList, isLight && { backgroundColor: '#F8F9FA' }]}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListFooterComponent={
                        isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator color={isLight ? '#059669' : COLORS.secondary} size="small" />
                                <Text style={[styles.loadingText, isLight && { color: '#64748B' }]}>
                                    {t("Thinking...") || "Thinking..."}
                                </Text>
                            </View>
                        ) : null
                    }
                />

                <View style={[
                    styles.inputWrapper,
                    { paddingBottom: Math.max(insets.bottom, hp('1.5%')) },
                    isLight && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0' }
                ]}>
                    {/* Quick suggestion chips */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.suggestionRow}
                    >
                        {suggestedQueries.map((q, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[
                                    styles.suggestionChip,
                                    isLight && { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }
                                ]}
                                onPress={() => handleSend(q)}
                                disabled={isLoading}
                            >
                                <Text style={[
                                    styles.suggestionChipText,
                                    isLight && { color: '#0F172A' }
                                ]}>
                                    {q}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={[styles.inputContainer, isLight && { backgroundColor: '#F1F5F9' }]}>
                        <TextInput
                            style={[styles.input, isLight && { color: '#0F172A' }]}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder={t("Ask about your finances...") || "Ask about your finances..."}
                            placeholderTextColor={isLight ? '#94A3B8' : COLORS.text.secondary}
                            multiline
                            editable={!isLoading}
                            maxLength={500}
                        />
                        <TouchableOpacity
                            onPress={() => handleSend()}
                            style={[
                                styles.sendButton,
                                inputText.trim() && !isLoading && styles.sendButtonActive,
                            ]}
                            disabled={isLoading || !inputText.trim()}
                        >
                            <Ionicons
                                name="send"
                                size={wp('5%')}
                                color={inputText.trim() && !isLoading ? '#fff' : COLORS.text.secondary}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: wp('4%'),
        paddingVertical: hp('1.5%'),
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lightbackground,
        backgroundColor: COLORS.background,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        width: wp('9%'),
        height: wp('9%'),
        borderRadius: wp('4.5%'),
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: wp('3%'),
    },
    headerText: {
        fontSize: wp('4.5%'),
        fontWeight: 'bold',
        color: COLORS.text.primary,
    },
    closeButton: {
        padding: wp('1%'),
    },
    messagesList: {
        paddingHorizontal: wp('4%'),
        paddingTop: hp('1%'),
        paddingBottom: hp('2%'),
        flexGrow: 1,
    },
    messageContainer: {
        maxWidth: '85%',
        marginVertical: hp('0.6%'),
        padding: wp('3.5%'),
        borderRadius: wp('4%'),
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: COLORS.primary,
        borderBottomRightRadius: wp('1%'),
    },
    aiMessage: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.lightbackground,
        borderBottomLeftRadius: wp('1%'),
    },
    aiAvatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: hp('0.5%'),
    },
    aiAvatar: {
        width: wp('5%'),
        height: wp('5%'),
        borderRadius: wp('2.5%'),
        backgroundColor: 'rgba(237, 253, 154, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: wp('1.5%'),
    },
    aiLabel: {
        fontSize: wp('2.8%'),
        color: COLORS.secondary,
        fontWeight: '600',
    },
    messageText: {
        fontSize: wp('3.6%'),
        color: COLORS.text.primary,
        lineHeight: wp('5.2%'),
    },
    userMessageText: {
        color: '#FFFFFF',
    },
    aiMessageText: {
        color: COLORS.text.primary,
    },
    suggestionRow: {
        paddingVertical: hp('0.8%'),
        paddingHorizontal: wp('1%'),
        gap: wp('2%'),
    },
    suggestionChip: {
        backgroundColor: COLORS.lightbackground,
        paddingHorizontal: wp('3%'),
        paddingVertical: hp('0.8%'),
        borderRadius: wp('4%'),
        borderWidth: 1,
        borderColor: 'rgba(237, 253, 154, 0.25)',
    },
    suggestionChipText: {
        fontSize: wp('3.1%'),
        color: COLORS.secondary,
        fontWeight: '500',
    },
    inputWrapper: {
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightbackground,
        paddingHorizontal: wp('3%'),
        paddingTop: hp('0.5%'),
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: COLORS.lightbackground,
        borderRadius: wp('5%'),
        paddingHorizontal: wp('3%'),
        paddingVertical: hp('0.5%'),
        marginTop: hp('0.5%'),
    },
    input: {
        flex: 1,
        color: COLORS.text.primary,
        fontSize: wp('3.8%'),
        maxHeight: hp('12%'),
        paddingVertical: hp('1%'),
    },
    sendButton: {
        width: wp('9%'),
        height: wp('9%'),
        borderRadius: wp('4.5%'),
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: wp('2%'),
        marginBottom: hp('0.2%'),
    },
    sendButtonActive: {
        backgroundColor: COLORS.primary,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: wp('3%'),
        alignSelf: 'flex-start',
    },
    loadingText: {
        color: COLORS.text.secondary,
        fontSize: wp('3.2%'),
        marginLeft: wp('2%'),
    },
});

export default ChatInterface;
