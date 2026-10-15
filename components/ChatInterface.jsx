import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import { chatWithAI, getInitialAnalysis } from '../utils/aiService';
import LottieView from 'lottie-react-native';

const ChatInterface = ({ summary, transactions, onClose }) => {
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState([
        {
            id: '1',
            text: "Hi! I'm your personal finance advisor from Team Auxin. I'm analyzing your financial data...",
            isUser: false,
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const flatListRef = useRef();

    useEffect(() => {
        const fetchInitialAnalysis = async () => {
            try {
                const analysis = await getInitialAnalysis(summary, transactions);
                setMessages(prev => [
                    ...prev,
                    {
                        id: Date.now().toString(),
                        text: analysis,
                        isUser: false,
                    }
                ]);
            } catch (error) {
                console.error('Initial analysis error:', error);
                setMessages(prev => [
                    ...prev,
                    {
                        id: Date.now().toString(),
                        text: "I encountered an error analyzing your data. Feel free to ask me specific questions about your finances.",
                        isUser: false,
                    }
                ]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialAnalysis();
    }, [summary, transactions]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const userMessage = {
            id: Date.now().toString(),
            text: inputText.trim(),
            isUser: true,
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            const response = await chatWithAI(inputText, summary, transactions);
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
                text: 'Sorry, I encountered an error. Please try again.',
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
                    item.isUser ? styles.userMessage : styles.aiMessage,
                ]}
            >
                {!item.isUser && (
                    <View style={styles.aiAvatarRow}>
                        <View style={styles.aiAvatar}>
                            <Ionicons name="sparkles" size={wp('3.5%')} color={COLORS.secondary} />
                        </View>
                        <Text style={styles.aiLabel}>FinFit AI Advisor</Text>
                    </View>
                )}
                <Text style={[
                    styles.messageText,
                    item.isUser ? styles.userMessageText : styles.aiMessageText,
                ]}>
                    {textContent}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.container}
                keyboardVerticalOffset={Platform.OS === 'ios' ? hp('2%') : 0}
            >
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerIcon}>
                            <Ionicons name="chatbubbles" size={wp('5%')} color="#FFFFFF" />
                        </View>
                        <View>
                            <Text style={styles.headerText}>Financial Advisor</Text>
                            <Text style={{ fontSize: wp('2.8%'), color: COLORS.secondary }}>Powered by FinFit AI</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={wp('7%')} color={COLORS.text.secondary} />
                    </TouchableOpacity>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.messagesList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListFooterComponent={
                        isLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator color={COLORS.secondary} size="small" />
                                <Text style={styles.loadingText}>Thinking...</Text>
                            </View>
                        ) : null
                    }
                />

                <View style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, hp('1.5%')) }]}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Ask about your finances..."
                            placeholderTextColor={COLORS.text.secondary}
                            multiline
                            editable={!isLoading}
                            maxLength={500}
                        />
                        <TouchableOpacity
                            onPress={handleSend}
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
    bulletLine: {
        fontSize: wp('3.6%'),
        color: COLORS.text.primary,
        lineHeight: wp('5.2%'),
    },
    inputWrapper: {
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.lightbackground,
        paddingHorizontal: wp('3%'),
        paddingTop: hp('1%'),
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: COLORS.lightbackground,
        borderRadius: wp('5%'),
        paddingHorizontal: wp('3%'),
        paddingVertical: hp('0.5%'),
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
    loadingAnimation: {
        height: wp(20),
        width: wp(20)
    }
});

export default ChatInterface;
